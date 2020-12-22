var VG = (function(vg, $) {

  var DEFAULT_OPTIONS = {
    draw_arrowhead: true,
    arrow_angle: Math.PI / 12,
    arrow_length: 10,
    padding: 10,
    edge_width: 2,
    edge_color: '#fe8080',
    emph_edge_color: '#f00'
  };

  // Helper method to compute Raphael path strings for the 
  function computeArrowPaths(paper, x0, y0, x1, y1, options) {

    options = vg.merge_options(options, DEFAULT_OPTIONS);

    var dx = x1 - x0;
    var dy = y1 - y0;

    if (dx === 0 && dy === 0) {
      return {
        "headPathString": "",
        "shaftPathString": ""
      };
    }

    // Adjust the endpoints so they don't overlap the circle
    var pad = options.padding; 
    var factor = pad / Math.sqrt(dx * dx + dy * dy);
    x0 += factor * dx;
    y0 += factor * dy;
    x1 -= factor * dx;
    y1 -= factor * dy;
    dx = x1 - x0;
    dy = y1 - y0;

    // Compute the coordinates of the arrowhead
    var arrowLength = options.arrow_length;
    var arrowAngle = options.arrow_angle;
    var x2 = x1 - arrowLength * Math.sin(Math.atan2(dx, dy) + arrowAngle);
    var y2 = y1 - arrowLength * Math.cos(Math.atan2(dx, dy) + arrowAngle);
    var x3 = x1 - arrowLength * Math.sin(Math.atan2(dx, dy) - arrowAngle);
    var y3 = y1 - arrowLength * Math.cos(Math.atan2(dx, dy) - arrowAngle);

    var headPathString = Raphael.format("M{0},{1}L{2},{3}L{4},{5}Z",
                                        x1, y1, x2, y2, x3, y3);

    // Adjust the endpoints of the line segment so it ends inside the arrowhead,
    // but only do so if we are drawing arrowheads
    if (options.draw_arrowheads) {
      factor = arrowLength / Math.sqrt(dx * dx + dy * dy);
      x1 -= factor * dx;
      y1 -= factor * dy;
    }

    var shaftPathString = Raphael.format("M{0},{1}L{2},{3}Z", x0, y0, x1, y1);
  
    return {
      "headPathString": headPathString,
      "shaftPathString": shaftPathString
    };
  }

  vg.Arrow = function(paper, x0, y0, x1, y1, options) {
    var that = (this === vg ? {} : this);

    options = vg.merge_options(options, DEFAULT_OPTIONS);

    var head = null;
    var shaft = null;

    function draw() {
      // First remove any old arrow parts
      if (head !== null) head.remove();
      if (shaft !== null) shaft.remove();

      // Compute path strings
      var path_strings = computeArrowPaths(paper, x0, y0, x1, y1, options);

      // Redraw the shaft
      shaft = paper.path(path_strings.shaftPathString);
      shaft.attr({
        'stroke-width': options.edge_width,
        'stroke': options.edge_color
      });

      // Maybe redraw the head
      if (options.draw_arrowhead) {
        head = paper.path(path_strings.headPathString);
        head.attr({
          'fill': options.edge_color,
          'stroke': options.edge_color
        });
      }
    }

    draw();

    that.remove = function() {
      if (head !== null) head.remove();
      if (shaft !== null) shaft.remove();
    }

    // Emphasize the arrow by changing its color.
    that.emphasize = function() {
      if (head) {
        head.attr({'stroke': options.emph_edge_color,
                   'fill': options.emph_edge_color});
      }
      if (shaft) {
        shaft.attr({'stroke': options.emph_edge_color});
      }
    }

    // Deemphasize the arrow by restoring its color.
    that.deemphasize = function() {
      if (head) {
        head.attr({'stroke': options.edge_color,
                   'fill': options.edge_color});
      }
      if (shaft) {
        shaft.attr({'stroke': options.edge_color});
      }
    }

    that.hide = function() {
      if (head) head.attr({'opacity': 0});
      if (shaft) shaft.attr({'opacity': 0});
    }

    that.show = function() {
      if (head) head.attr({'opacity': 1});
      if (shaft) shaft.attr({'opacity': 1});
    }

    return that;
  }

  return vg;

}(VG || {}, jQuery));
