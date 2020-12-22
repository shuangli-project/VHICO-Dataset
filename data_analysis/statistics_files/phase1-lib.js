var VG = (function(vg) {

  var MIN_IMAGE_WIDTH = 900;
  var MAX_IMAGE_WIDTH = 900;
  var IMAGE_OPACITY = 0.6;

  var USE_EXTENTS = true;

  /**
   * A little object to manage state during drag events that change the extent
   * of an object. Such drags might happen when the object is created or after
   * the object is created, so this object allows the same logic to be used in
   * both situations.
   */
  function DragManager(obj) {
    var that = (this === window ? {} : this);

    var center_x = null;
    var center_y = null;

    var start_x = null;
    var start_y = null;

    var start_extent = null;

    var cur_x = null;
    var cur_y = null;

    /**
     * cx, cy: Position of the center of the circle-object
     * sx, sy: Position of the cursor at the start of the drag
     * r: Starting radius of the circle-object.
     */
    that.start = function(cx, cy, sx, sy, r) {
      center_x = cx;
      center_y = cy;
      start_x = sx;
      start_y = sy;
      start_extent = r;
    }

    that.move = function(x, y) {
      cur_x = x;
      cur_y = y;
    }

    that.getCurrentExtent = function() {
      var dx = center_x - start_x;
      var dy = center_y - start_y;
      var start_d = Math.sqrt(dx * dx + dy * dy);
      
      dx = center_x - cur_x;
      dy = center_y - cur_y;
      var cur_d = Math.sqrt(dx * dx + dy * dy);

      return start_extent + cur_d - start_d;
    }

    return that;
  }

  vg.PhaseIController = function(div, image_url, synset_picker) {
    var that = (this === vg ? {} : this);
    var width = MAX_IMAGE_WIDTH;
    
    var paper = new Raphael(div, width, 0);
    var div_selector = $(div);
    var boundary = null;
    var scale = null;
    var image = null;
    var colorFactory = VG.ColorFactory();

    var wnid_to_color = {};
    var next_obj_idx = 0;
    var ui_objects = {};
    var image_objects = [];

    var disabled = false;

    var image_object_buffer = [];

    function getMousePosition(e) {
      var x = e.pageX - div_selector.offset().left;
      var y = e.pageY - div_selector.offset().top;
      return {x: x, y: y};
    }

    function loadImage() {
      var img = new Image();
      img.onload = function() {
        var w = this.width;
        var h = this.height;
        if (w > paper.width) {
          scale = paper.width / w;
          h = h * scale;
          w = paper.width;
        } else if (w < MIN_IMAGE_WIDTH) {
          scale = MIN_IMAGE_WIDTH / w;
          h = h * scale;
          w = MIN_IMAGE_WIDTH;
        }
        paper.setSize(w, h);
        image = paper.image(image_url, 0, 0, w, h)
                     .attr({'OPACITY': IMAGE_OPACITY,
                           'cursor': 'crosshair'})
                     .toBack();
        init();
      }
      img.src = image_url;
    }

    function init() {
      synset_picker.focus();
      image.click(function(e) {
        var pos = getMousePosition(e);
        var x = pos.x;
        var y = pos.y;
        maybeAddObject(x, y);
      });

      if (USE_EXTENTS) {
        var drag_manager = new DragManager();
        var obj = null;
        var onstart = function(x, y, e) {
          var pos = getMousePosition(e);
          var x = pos.x;
          var y = pos.y;
          obj = maybeAddObject(x, y);
          if (obj) {
            drag_manager.start(x, y, x, y, obj.getExtent());
          }
        }

        var onmove = function(dx, dy, x, y, e) {
          if (obj) {
            var pos = getMousePosition(e);
            var x = pos.x;
            var y = pos.y;
            drag_manager.move(x, y);
            obj.setExtent(drag_manager.getCurrentExtent());
            image_objects[obj._idx_].r = obj.getExtent() / scale;
          }
        }

        var onend = function() {
          obj = null;
        }
      }

      image.drag(onmove, onstart, onend);

      for (var i = 0; i < image_object_buffer.length; i++) {
        that.addObject(image_object_buffer[i]);
      }
    }

    function maybeAddObject(x, y) {
      if (disabled) return null;
      var wnid = synset_picker.getWnid();
      if (wnid != null) {
        var name = synset_picker.getName();
        return that.addObject({
          x: x / scale,
          y: y / scale,
          r: 0,
          name: name,
          wnid: wnid
        })
      } else {
        alert('You need to select an object type!');
      }
    }

    loadImage();

    /**
     * Add an object of the form
     * {
     *   x: x,
     *   y: y,
     *   r: r,
     *   name: 'name',
     *   wnid: 'wnid'
     * }
     * 
     * where x and y are the coordinates in image space, and r is the radius.
     * If the synset is not in the SynsetPicker then it is added.
     *
     * Calls to addObject that are made before the image loads are batched and
     * retried once the image loads.
     *
     * Returns the created object or null if object creation is delayed.
     */
    that.addObject = function(o) {
      if (scale === null) {
        image_object_buffer.push(o);
        return null;
      }

      var wnid = o.wnid;
      synset_picker.addSynset(wnid, o.name);
      var color = null;
      if (typeof(wnid_to_color[wnid]) !== 'undefined') {
        color = wnid_to_color[wnid];
      } else {
        color = colorFactory.nextColor();
        wnid_to_color[wnid] = color;
      }
      var x = o.x * scale;
      var y = o.y * scale;
      var obj = new vg.CircleObject(paper, x, y, color, o.name);
      if (USE_EXTENTS) {
        obj.setExtent(o.r * scale);
      } else {
        obj.setExtent(0);
      }
      obj._idx_ = next_obj_idx++;
      ui_objects[obj._idx_] = obj;
      image_objects[obj._idx_] = o;

      var drag_manager = new DragManager();

      obj.setCallbacks({
        dblclick: function(e) {
          if (disabled) return;

          obj.remove();
          ui_objects[obj._idx_] = null;
          image_objects[obj._idx_] = null;
        },
        onmovestart: function(x, y, e) {
          if (disabled) return;

          var pos = getMousePosition(e);
          x = pos.x;
          y = pos.y;

          drag_manager.start(obj.getX(), obj.getY(), x, y, obj.getExtent());
        },
        onmove: function(dx, dy, x, y, e) {
          if (disabled) return;

          var pos = getMousePosition(e);
          var x = pos.x;
          var y = pos.y;

          e = jQuery.event.fix(e);
          if (e.shiftKey) {
            // Move the dot
            image_objects[obj._idx_].x = x / scale;
            image_objects[obj._idx_].y = y / scale;
            obj.moveTo(x, y);
          } else {
            if (!USE_EXTENTS) return;
            // Change the extent
            drag_manager.move(x, y);
            obj.setExtent(drag_manager.getCurrentExtent());
            image_objects[obj._idx_].r = obj.getExtent() / scale;
          }
        },
        hover_in: function() { obj.emphasize(); },
        hover_out: function() { obj.deemphasize(); }
      });

      return obj;
    }

    /**
     * Get an array describing all objects that have been annotated so far.
     * Each object has the following form:
     *
     * {
     *   x: x,
     *   y: y,
     *   name: 'name',
     *   wnid: 'wnid'
     * }
     *
     * Note that the x and y elements are in the original image coordinates, NOT
     * the possibly-rescaled Raphael canvas coordinates.
     */
    that.getObjects = function() {
      var objs = [];

      for (var i = 0; i < image_objects.length; i++) {
        if (image_objects[i] !== null) {
          var obj = {
            x: image_objects[i].x,
            y: image_objects[i].y,
            r: image_objects[i].r,
            name: image_objects[i].name,
            wnid: image_objects[i].wnid
          };
          objs.push(obj);
        }
      }
      return objs;
    }

    /**
     * Disable this controller so that it will not respond to click events.
     * Also disables the SynsetPicker.
     */
    that.disable = function() {
      synset_picker.disable();
      disabled = true;
    }

    /**
     * Enable this controller so it will once again respond to click events.
     * Also enables the SynsetPicker.
     */
    that.enable = function() {
      synset_picker.enable();
      disabled = false;
    }

    return that;
  }

  return vg;

}(VG || {}));
