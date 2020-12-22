var VG = (function(vg, $) {

  var DEFAULT_OPTIONS = {
    static_box_color: '#B00C0C',
    bbox_color: '#B00C0C',
    bbox_line_width: 2.0,
    click_radius: 15,
    handle_opacity: 0.2,
    dot_small_radius: 5,
    dot_big_radius: 5,
    image_opacity: 1.0,
    max_height: null,
    max_width: null,
    callback: function() {},
  };

  /*
  var STATIC_BOX_COLOR = '#f00';
  var BBOX_COLOR = '#00f';
  var BBOX_LINE_WIDTH = 2.0;

  var CLICK_RADIUS = 15;
  var HANDLE_OPACITY = 0.2;

  var OBJECT_SMALL_RADIUS = 5;
  var OBJECT_BIG_RADIUS = 10;
  */

  var TEXT_FONT_SIZE = 20;
  var TEXT_FONT = TEXT_FONT_SIZE + 'px sans-serif';
  var TEXT_BOX_PADDING = 4;

  vg.BBoxDrawer = function(div, image_url, canvas_width, options) {
    var that = (this === vg ? {} : this);

    options = vg.merge_options(options, DEFAULT_OPTIONS);

    var scale = null;
    if (_.isNumber(options.scale)) {
      scale = options.scale;
    }
    var canvas = null;
    var canvas_pos = null;
    var ctx = null;
    var crosshairs = true;

    // Most recent positions of the mouse and of a click
    var click_pos = null;
    var mouse_pos = null;

    // Whether the box has been been finalized after the initial drag
    var bbox_drawn = false;

    // list of persisting static boxes and objects
    var boxes = [];
    var objects = [];

    // Object with properties x, y, w, h
    var bbox = null;
    var static_box = null;

    var object_pos = null;
    var object_name = null;

    var resize_direction = null;
    var old_bbox = null;

    var disabled = true;

    var cursors = {
      'UL': 'nw-resize',
      'UR': 'ne-resize',
      'BL': 'sw-resize',
      'BR': 'se-resize',
      'U': 'n-resize',
      'R': 'e-resize',
      'L': 'w-resize',
      'B': 's-resize',
    };

    var img = new Image();
    img.onload = setup;
    img.src = image_url;

    that.getBoxPosition = function() {
      if (bbox) {
        // Convert to image coordinates
        return {
          'x': toImageCoords(bbox.x),
          'y': toImageCoords(bbox.y),
          'w': toImageCoords(bbox.w),
          'h': toImageCoords(bbox.h)
        };
      }
      return null;
    }

    that.setBoxPosition = function(b) {
      scale = choose_scale(img);
      // copy it over
      bbox = {};
      bbox.x = Math.floor(toCanvasCoords(b.x));
      bbox.y = Math.floor(toCanvasCoords(b.y));
      bbox.w = Math.floor(toCanvasCoords(b.w));
      bbox.h = Math.floor(toCanvasCoords(b.h));
      draw();
    }


    that.enable = function() {
      disabled = false;
      draw();
    }

    that.disable = function() {
      disabled = true;
      mouseup();
      draw();
    }

    that.setObject = function(x, y, name) {
      if (scale) {
        object_pos = {'x': toCanvasCoords(x), 'y': toCanvasCoords(y)};
      } else {
        object_pos = {'x': x, 'y': y};
      }
      object_name = name;
    }

    that.setStaticBox = function(box) {
      static_box = $.extend({}, box);
      if (scale) {
        static_box.x = toCanvasCoords(box.x);
        static_box.y = toCanvasCoords(box.y);
        static_box.w = toCanvasCoords(box.w);
        static_box.h = toCanvasCoords(box.h);
      }
      draw();
    }

    that.drawBoxes = function(_boxes) {
      if (scale) {
        scaledBoxes = [];
        $.each(_boxes, function(index, box) {
          scaledBox = {
            'x': toCanvasCoords(box.x),
            'y': toCanvasCoords(box.y),
            'w': toCanvasCoords(box.w),
            'h': toCanvasCoords(box.h)
          }
          if ('color' in box) {
            scaledBox.color = box.color;
          }
          scaledBoxes.push(scaledBox);
        });
        boxes = scaledBoxes;
        draw();
      } else {
        boxes = _boxes;
        draw();
      }
    }

    that.drawObjects = function(_objects) {
      if (scale) {
        scaledObjects = [];
        $.each(_objects, function(index, obj) {
          scaledObject = {
            'x': toCanvasCoords(obj.x),
            'y': toCanvasCoords(obj.y),
            'name': obj.name
          }
          scaledObjects.push(scaledObject);
        });
        objects = scaledObjects;
        draw();
      } else {
        objects = _objects;
        draw();
      }
    }

    function choose_scale(img) {
      if (_.isNumber(options.max_width) && _.isNumber(options.max_height)) {
        var scale_h = img.width / options.max_width;
        var scale_v = img.height / options.max_height;
        return Math.max(scale_h, scale_v);
      } else {
        return img.width / canvas_width;
      }
    }

    that.restoring = function() {
      bbox_drawn = true;
    }

    that.reset = function() {
      click_pos = null;
      mouse_pos = null;
      bbox_drawn = false;
      bbox = null;
      static_box = null;
      var object_pos = null;
      var object_name = null;
      var resize_direction = null;
      var old_bbox = null;
      if (crosshairs) {
        $("#drawcanv").css({'cursor': 'crosshair'}); // reset cursor
      } else {
        $("#drawcanv").css({'cursor': 'default'});
      }
      draw();
    }

    that.disable_crosshairs = function() {
      crosshairs = false;
      $("#drawcanv").css({'cursor': 'default'});
    }
    that.enable_crosshairs = function() {
      crosshairs = true;
      $("#drawcanv").css({'cursor': 'crosshair'}); // reset cursor
    }

    function setup() {
      scale = choose_scale(img);
      canvas_width = img.width / scale;
      var canvas_height = img.height / scale;
      canvas = $('<canvas>');
      canvas.attr({'width': canvas_width,
                   'height': canvas_height})
            .css({'cursor': 'crosshair'})
            .appendTo(div);
      if (!crosshairs) {
        canvas.css({'cursor': 'default'});
      }

      canvas_pos = {'x': canvas.offset().left, 'y': canvas.offset().top};
      ctx = canvas[0].getContext('2d');
      canvas.mousemove(mousemove);
      canvas.mousedown(mousedown);
      canvas.mouseup(mouseup);
      canvas.mouseout(mouseup);

      if (object_pos) {
        object_pos.x = toCanvasCoords(object_pos.x);
        object_pos.y = toCanvasCoords(object_pos.y);
      }

      /* Convert the static box from image coordinates to canvas coordinates
      if (static_box) {
        var props = ['x', 'y', 'w', 'h'];
        for (var i = 0; i < props.length; i++) {
          static_box[props[i]] = toCanvasCoords(static_box[props[i]]);
        }
      }*/

      draw();
      options.callback();
    }

    function toCanvasCoords(x) { return x / scale; }
    function toImageCoords(x) { return x * scale; }
    function setCursor(cursor) { canvas.css('cursor', cursor); }

    function getPosition(e) {
      var x = e.pageX - canvas_pos.x;
      var y = e.pageY - canvas_pos.y;
      return {'x': x, 'y': y};
    }

    function mousedown(e) {
      if (disabled) return;
      click_pos = getPosition(e);
      if (bbox) {
        resize_direction = detectCollision(click_pos.x, click_pos.y, bbox);
        if (resize_direction) {
          old_bbox = $.extend({}, bbox);
        }
      }
    }

    function mouseup(e) {
      click_pos = null;
      resize_direction = null;
      if (bbox) {
        bbox_drawn = true;
        setCursor('pointer');
      }
      draw();
    }

    function mousemove(e) {
      mouse_pos = getPosition(e);
      updateBBox();

      if (bbox && !click_pos && !disabled) {
        var collision = detectCollision(mouse_pos.x, mouse_pos.y, bbox);
        if (cursors.hasOwnProperty(collision)) {
          setCursor(cursors[collision]);
        } else {
          setCursor('pointer');
        }
      }

      draw();
    }

    function detectCollision(x, y, box) {
      function dist(x1, y1, x2, y2) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
      }
      if (dist(x, y, box.x, box.y) < options.click_radius) {
        return 'UL';
      } else if (dist(x, y, box.x + box.w, box.y) < options.click_radius) {
        return 'UR';
      } else if (dist(x, y, box.x, box.y + box.h) < options.click_radius) {
        return 'BL';
      } else if (dist(x, y, box.x + box.w, box.y + box.h)
                 < options.click_radius) {
        return 'BR';
      } else if (Math.abs(box.x - x) < options.click_radius) {
        return 'L';
      } else if (Math.abs(box.x + box.w - x) < options.click_radius) {
        return 'R';
      } else if (Math.abs(box.y - y) < options.click_radius
                 && x >= bbox.x && x <= bbox.x + bbox.w) {
        return 'U';
      } else if (Math.abs(box.y + box.h - y) < options.click_radius
                 && y >= bbox.y && y <= bbox.y + bbox.h) {
        return 'B';
      }

      return null;
    }

    function updateBBox() {
      function makeBBox(x1, y1, x2, y2) {
        var x = Math.min(x1, x2);
        var y = Math.min(y1, y2);
        var w = Math.max(x1, x2) - x;
        var h = Math.max(y1, y2) - y;
        return {'x': x, 'y': y, 'w': w, 'h': h};
      }
      if (!bbox_drawn && click_pos && mouse_pos) {
        bbox = makeBBox(click_pos.x, click_pos.y, mouse_pos.x, mouse_pos.y);
      } else if (bbox_drawn && click_pos && mouse_pos && resize_direction) {
        var x1 = old_bbox.x;
        var x2 = old_bbox.x + old_bbox.w;
        var y1 = old_bbox.y;
        var y2 = old_bbox.y + old_bbox.h;
        if (resize_direction === 'L'
            || resize_direction === 'UL'
            || resize_direction === 'BL') {
          x1 = mouse_pos.x;
        }
        if (resize_direction === 'R'
            || resize_direction === 'UR'
            || resize_direction === 'BR') {
          x2 = mouse_pos.x;
        }
        if (resize_direction === 'U'
            || resize_direction === 'UR'
            || resize_direction === 'UL') {
          y1 = mouse_pos.y;
        }
        if (resize_direction === 'B'
            || resize_direction === 'BR'
            || resize_direction === 'BL') {
          y2 = mouse_pos.y;
        }
        bbox = makeBBox(x1, y1, x2, y2);
      }
    }

    function drawBox(box, box_color) {
      ctx.save();

      function r(x) { return Math.floor(x); }

      ctx.strokeStyle = box_color;
      ctx.lineWidth = options.bbox_line_width;
      ctx.strokeRect(r(box.x), r(box.y), r(box.w), r(box.h));

      ctx.restore();
    }

    function drawCrosshair(x, y) {
      y = Math.floor(y) + 0.5;
      x = Math.floor(x) + 0.5;

      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff';
      ctx.globalAlpha = 0.3;

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height());
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width(), y);
      ctx.stroke();

      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000';
      ctx.globalAlpha = 1.0;

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height());
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width(), y);
      ctx.stroke();

      ctx.restore();
    }

    function drawHandle(x, y) {
      ctx.save();
      ctx.globalAlpha = options.handle_opacity;

      ctx.beginPath();
      ctx.arc(x, y, options.click_radius, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    function drawObject(x, y, name, emphasized) {
      ctx.save();
      ctx.fillStyle = options.bbox_color;

      var r = emphasized ? options.dot_big_radius : options.dot_small_radius;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (emphasized) {
        // Draw the text box
        var width = ctx.measureText(name).width;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.strokeStyle = '#000';
        ctx.beginPath();
        var x1 = x - width - TEXT_BOX_PADDING;
        var x2 = x + width + TEXT_BOX_PADDING;
        var y1 = y + options.dot_big_radius + 1.5 * TEXT_BOX_PADDING;
        var y2 = y1 + 1.5 * TEXT_BOX_PADDING + TEXT_FONT_SIZE;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1, y2);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, y1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.font = TEXT_FONT;
        ctx.fillStyle = '#000';
        var tx = x - width;
        var ty = y + TEXT_FONT_SIZE + 2.5 * TEXT_BOX_PADDING + options.dot_big_radius;
        ctx.fillText(name, tx, ty);
      }

      ctx.restore();
    }

    function draw() {
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width(), canvas.height());
      ctx.save();
      ctx.globalAlpha = disabled ? 1.0 : options.image_opacity;
      ctx.drawImage(img, 0, 0, canvas.width(), canvas.height());
      ctx.restore();

      if (boxes.length > 0) {
        for(var i=0; i<boxes.length;i++) {
          // uses sentinel value of boxes's x value to decide whether to draw
          if (boxes[i].x < 0) continue;
          if ('color' in boxes[i]) {
            drawBox(boxes[i], boxes[i].color);
          } else{
            drawBox(boxes[i], options.bbox_color);
          }
        }
      }

      if (objects.length > 0) {
        for(var i=0; i<objects.length;i++) {
          drawObject(objects[i].x, objects[i].y, objects[i].name, true);
        }
      }

      if (static_box) {
        drawBox(static_box, options.static_box_color);
      }

      if (disabled) return;

      if (object_name && object_pos) {
        var emphasized = false;
        if (mouse_pos) {
          var dx = mouse_pos.x - object_pos.x;
          var dy = mouse_pos.y - object_pos.y;
          if (Math.sqrt(dx * dx + dy * dy) < options.click_radius) {
            emphasized = true;
          }
        }

        drawObject(object_pos.x, object_pos.y, object_name, emphasized);
      }

      if (bbox) {
        if (bbox_drawn) {
          drawHandle(bbox.x, bbox.y);
          drawHandle(bbox.x + bbox.w, bbox.y);
          drawHandle(bbox.x, bbox.y + bbox.h);
          drawHandle(bbox.x + bbox.w, bbox.y + bbox.h);
        } else {
          drawCrosshair(bbox.x, bbox.y);
          drawCrosshair(bbox.x + bbox.w, bbox.y + bbox.h);
        }
        drawBox(bbox, options.bbox_color);
      } else if (mouse_pos) {
        drawCrosshair(mouse_pos.x, mouse_pos.y);
      }
    }

    that.remove = function() {
      canvas.remove();
    }

    return that;
  }

  return vg;

}(VG || {}, jQuery));

