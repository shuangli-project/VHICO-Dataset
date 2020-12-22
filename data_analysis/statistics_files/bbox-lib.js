var VG = (function(vg) {

  // Private helper to perform a deep copy of bbox pos objects.
  function clonePos(pos) {
      return {x: pos.x, y: pos.y, w: pos.w, h: pos.h};
  }


  /**
   * Constructor for a private helper object that manages state during drag
   * events for an ImageBBox.
   *
   * Has the following methods:
   * start(pos) - Indicates the start of a drag event, where pos is the initial
   *              position of the bounding box at the start of the drag event.
   * dragTop(dx, dy) - Indicates a drag event on the top of the bounding box.
   *                   dx and dy are pixel offsets of the cursor since the start
   *                   of the drag event.
   * dragBottom(dx, dy) - Indicates a drag event on the bottom of the box.
   * dragLeft(dx, dy) - Indicates a drag event on the left of the box.
   * dragRight(dx, dy) - Indicates a drag event on the right of the box.
   * end() - Indicates the end of a drag event.
   * getPos() - Get the current position of the bounding box if all drag* events
   *            are taken into account.
   */
  function DragManager() {
    var that = (this === window ? {} : this);

    var start_pos = null;
    var cur_pos = null;

    that.start = function(pos) {
      start_pos = clonePos(pos);
      cur_pos = clonePos(start_pos);
    }

    that.end = function() {
      start_pos = null;
      cur_pos = null;
    }

    that.dragTop = function(dx, dy) {
      cur_pos.y = start_pos.y + dy;
      cur_pos.h = start_pos.h - dy;
    }

    that.dragBottom = function(dx, dy) {
      cur_pos.h = start_pos.h + dy;
    }

    that.dragRight = function(dx, dy) {
      cur_pos.w = start_pos.w + dx;
    }

    that.dragLeft = function(dx, dy) {
      cur_pos.x = start_pos.x + dx;
      cur_pos.w = start_pos.w - dx;
    }

    that.getPos = function() {
      return clonePos(cur_pos);
    }

    return that;
  }


  /**
   * View-like class to represent an interactive bounding box in a Raphael
   * canvas.
   *
   * The object keeps track of drag events that would change its shape, and
   * optionally calls a specified callback whenever such events occur.
   *
   * Constructor arguments:
   * paper: Raphael paper object on which to draw the bounding box
   * pos: Initial position of the bounding box. This should be an object with
   *      fields x, y, w, h.
   * color: Raphael color object specifying the color of the box.
   *
   * Methods:
   *
   * setDragCallback(callback):
   * Sets the callback function for drag events. The callback should accept a
   * pos object representing the modified shape of the box if the drag were to
   * actually modify the shape of the box. The callback should not return
   * anything.
   *
   * setPosition(pos):
   * Sets the position for ths bounding box. A valid position must have positive
   * width and height and must be completely contained within the underlying
   * Raphael canvas. Invalid positions are ignored.
   *
   * getPosition():
   * Returns a pos object ({x: x, y: y, w: w, h: h}) representing the current
   * position of this bounding box on the Raphael canvas.
   */
  vg.ImageBBox = function(paper, pos, color) {
    var that = (this === vg ? {} : this);

    var STROKE_WIDTH = 4;

    var CLICK_REGION_WIDTH = 20;
    var CLICK_REGION_EDGE_OPACITY = 0;
    var CLICK_REGION_CORNER_OPACITY = 0;
    var CLICK_CORNER_RADIUS = 20;

    var rect = paper.rect();
    rect.attr({
        'stroke': color,
        'stroke-opacity': 1.0,
        'stroke-width': STROKE_WIDTH});

    var edge_click_regions = {
      top: paper.rect(),
      bottom: paper.rect(),
      left: paper.rect(),
      right: paper.rect(),
    };

    var corner_click_regions = {
      top_left: paper.circle(),
      top_right: paper.circle(),
      bottom_left: paper.circle(),
      bottom_right: paper.circle(),
    };

    edge_click_regions.top.attr({'cursor': 'ns-resize'});
    edge_click_regions.bottom.attr({'cursor': 'ns-resize'});
    edge_click_regions.left.attr({'cursor': 'ew-resize'});
    edge_click_regions.right.attr({'cursor': 'ew-resize'});

    corner_click_regions.top_left.attr({'cursor': 'nwse-resize'});
    corner_click_regions.top_right.attr({'cursor': 'nesw-resize'});
    corner_click_regions.bottom_left.attr({'cursor': 'nesw-resize'});
    corner_click_regions.bottom_right.attr({'cursor': 'nwse-resize'});

    that.setFixedPosition = function() {
      edge_click_regions.top.attr({'cursor': 'auto'});
      edge_click_regions.bottom.attr({'cursor': 'auto'});
      edge_click_regions.left.attr({'cursor': 'auto'});
      edge_click_regions.right.attr({'cursor': 'auto'});

      corner_click_regions.top_left.attr({'cursor': 'auto'});
      corner_click_regions.top_right.attr({'cursor': 'auto'});
      corner_click_regions.bottom_left.attr({'cursor': 'auto'});
      corner_click_regions.bottom_right.attr({'cursor': 'auto'});
    }

    var click_regions = $.extend({}, edge_click_regions, corner_click_regions);

    // Little utility to apply a function f to each value of an object o
    function apply_values(o, f) {
      for (var k in o) if (o.hasOwnProperty(k)) {
        f(o[k]);
      }
    }

    // Utility to set the opacity of a Raphael object
    function setOpacity(e, opacity) {
      e.attr({'fill-opacity': opacity, 'opacity': opacity});
    }

    function setCornerOpacity(corner_opacity) {
      apply_values(corner_click_regions,
                   function(e) { setOpacity(e, corner_opacity); });
    }
    setCornerOpacity(CLICK_REGION_CORNER_OPACITY);
    that.setCornerOpacity = setCornerOpacity;

    function setEdgeOpacity(edge_opacity) {
      apply_values(edge_click_regions,
                   function(e) { setOpacity(e, edge_opacity); });
    }
    setEdgeOpacity(CLICK_REGION_EDGE_OPACITY);
    that.setEdgeOpacity = setEdgeOpacity;

    apply_values(click_regions,
                 function(e) { e.attr({'fill': '#000000'}); });

    var drag_callback = null;

    positionElements();
    attachAllDragHandlers();

    that.setDragCallback = function(f) {
      drag_callback = f;
    }

    // A position is valid if its height and width are negative and if is not
    // off the edge of the Raphael canvas.
    function isValidPosition(new_pos) {
      var max_width = paper.canvas.height.baseVal.value;
      var max_height = paper.canvas.width.baseVal.value;
      return (new_pos.w > 0 && new_pos.h > 0
              && new_pos.x > 0 && new_pos.x + new_pos.w < max_width
              && new_pos.y > 0 && new_pos.y + new_pos.h < max_height);
    }

    // 'Fix' the position new_pos by moving it to the interior of the
    // Raphael canvas.
    function fixPosition(new_pos) {
      var max_width = paper.canvas.offsetWidth;
      var max_height = paper.canvas.offsetHeight;

      function clamp(x, low, high) {
        return Math.min(Math.max(x, low), high);
      }

      new_pos.x = clamp(new_pos.x, 0, max_width - new_pos.w);
      new_pos.y = clamp(new_pos.y, 0, max_height - new_pos.h);
    }

    function attachAllDragHandlers() {
      var drag_manager = new DragManager();
      function attachDragCallbacks(region, callback) {
        var move = function(dx, dy) {
          callback(dx, dy);
          var new_pos = drag_manager.getPos();
          if (drag_callback) {
            drag_callback(new_pos);
          }
        }
        var start = function() { drag_manager.start(pos); };
        var end = function() { drag_manager.end(pos); };
        region.drag(move, start, end);
      }
      attachDragCallbacks(
          click_regions.top,
          function(dx, dy) {
            drag_manager.dragTop(dx, dy);
          });
      attachDragCallbacks(
          click_regions.right,
          function(dx, dy) {
            drag_manager.dragRight(dx, dy);
          });
      attachDragCallbacks(
          click_regions.bottom,
          function(dx, dy) {
            drag_manager.dragBottom(dx, dy);
          });
      attachDragCallbacks(
          click_regions.left,
          function(dx, dy) {
            drag_manager.dragLeft(dx, dy); });
      attachDragCallbacks(
          click_regions.top_left,
          function(dx, dy) {
            drag_manager.dragTop(dx, dy);
            drag_manager.dragLeft(dx, dy);
          });
      attachDragCallbacks(
          click_regions.top_right,
          function(dx, dy) {
            drag_manager.dragTop(dx, dy);
            drag_manager.dragRight(dx, dy);
          });
      attachDragCallbacks(
          click_regions.bottom_left,
          function(dx, dy) {
            drag_manager.dragBottom(dx, dy);
            drag_manager.dragLeft(dx, dy);
          });
      attachDragCallbacks(
          click_regions.bottom_right,
          function(dx, dy) {
            drag_manager.dragBottom(dx, dy);
            drag_manager.dragRight(dx, dy);
          });
    }

    function positionElements() {
      rect.attr({
        'x': pos.x,
        'y': pos.y,
        'width': pos.w,
        'height': pos.h})

      click_regions.bottom.attr({
        'x': pos.x,
        'y': pos.y + pos.h - CLICK_REGION_WIDTH / 2,
        'width': pos.w,
        'height': CLICK_REGION_WIDTH});

      click_regions.top.attr({
        'x': pos.x,
        'y': pos.y - CLICK_REGION_WIDTH / 2,
        'width': pos.w,
        'height': CLICK_REGION_WIDTH});

      click_regions.right.attr({
        'x': pos.x + pos.w - CLICK_REGION_WIDTH / 2,
        'y': pos.y,
        'width': CLICK_REGION_WIDTH,
        'height': pos.h});

      click_regions.left.attr({
        'x': pos.x - CLICK_REGION_WIDTH / 2,
        'y': pos.y,
        'width': CLICK_REGION_WIDTH,
        'height': pos.h});

      click_regions.top_left.attr({
        'cx': pos.x,
        'cy': pos.y,
        'r': CLICK_CORNER_RADIUS});

      click_regions.top_right.attr({
        'cx': pos.x + pos.w,
        'cy': pos.y,
        'r': CLICK_CORNER_RADIUS});

      click_regions.bottom_left.attr({
        'cx': pos.x,
        'cy': pos.y + pos.h,
        'r': CLICK_CORNER_RADIUS});

      click_regions.bottom_right.attr({
        'cx': pos.x + pos.w,
        'cy': pos.y + pos.h,
        'r': CLICK_CORNER_RADIUS});
    }

    // Set the position of the bounding box.
    // new_pos should be an object with fields x, y, w, and h.
    // If the new position does not have positve width / height and
    // does not fit entirely on the underlying paper canvas then
    // this method does nothing.
    //
    // Returns true if the position is actually set and false otherwise.
    that.setPosition = function(new_pos) {
      // fixPosition(new_pos);
      if (isValidPosition(new_pos)) {
        pos = clonePos(new_pos);
        positionElements();
        return true;
      }
      return false;
    }

    // Get a copy of the current position of this bounding box.
    that.getPosition = function() {
      return clonePos(pos);
    }

    that.hide = function() {
      rect.hide();
      for (name in click_regions) {
        if (click_regions.hasOwnProperty(name)) {
          click_regions[name].hide();
        }
      }
    }

    that.show = function() {
      rect.show();
      for (name in click_regions) {
        if (click_regions.hasOwnProperty(name)) {
          click_regions[name].show();
        }
      }
    }

    return that;
  }


  return vg;

}(VG || {}));
