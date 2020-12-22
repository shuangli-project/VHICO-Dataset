var VG = (function(vg) {

  /**
   * Helper function to make a deep copy of a list of the form:
   * [
   *   {name: name, x: x, y: y},
   *   {name: name, x: x, y: y},
   *   ...
   * ]
   */
  function copy_objects(raw_objects) {
    var copied_objects = [];
    for (var i = 0; i < raw_objects.length; i++) {
      copied_objects.push({'name': raw_objects[i].name,
                           'x': raw_objects[i].x,
                           'y': raw_objects[i].y});
    }
    return copied_objects;
  }

  /**
   * Helper function to compute the distance between two objects in an image.
   * The image may be displayed at a size different from the actual image size;
   * this function gives the distance in pixels between the objects as
   * displayed.
   *
   * obj1, obj2: Objects with properties x and y giving the coordinates of the
   * objects with respect to the true images size.
   * true_image_width: Number giving the physical width (in pixels) of the image
   *                   containing the objects.
   * visible_image_width: Number giving the width (in pixels) at which the image
   *                      is being displayed.
   *
   * returns: Normalized distance between objects.
   */
  function distance(obj1, obj2, true_image_width, visible_image_width) {
    var dx = obj1.x - obj2.x;
    var dy = obj1.y - obj2.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    return (visible_image_width / true_image_width) * dist;
  }

  /**
   * Uses a heuristic to spread out points. In particular, we pick pairs of
   * points that are too close and spread them out, repeating for several
   * passes over the points.
   *
   * raw_objects: A list of objects of in the form
   *   [
   *     {name: name, x: x, y: y},
   *     {name: name, x: x, y: y},
   *     ...
   *   ]
   *
   * true_image_width, visible_image_width: Same as the distance function above.
   *
   * returns: A list as the same form as raw_objects, in the same order as
   *   raw_objects.
   */
  vg.spread_out_pairs = function(raw_objects, true_image_width,
                                 visible_image_width) {
    var min_distance = 20;
    var objects = copy_objects(raw_objects);
    var max_iterations = 5;
    var num_iterations = 0;

    // Utility function that binds true_image_width and visible_image_width
    var distFn = function(o1, o2) {
      return distance(o1, o2, true_image_width, visible_image_width);
    }

    while (true) {
      var close_pairs = [];
      for (var i = 0; i < objects.length; i++) {
        for (var j = i + 1; j < objects.length; j++) {
          if (distFn(objects[i], objects[j]) < min_distance) {
            close_pairs.push([i, j]);
          }
        }
      }

      if (close_pairs.length == 0) {
        break;
      }

      for (var k = 0; k < close_pairs.length; k++) {
        var i = close_pairs[k][0];
        var j = close_pairs[k][1];
        var dist = distFn(objects[i], objects[j]);
        if (dist >= min_distance) continue;
        if (dist < 1) {
          objects[i].x += 1;
          objects[j].y -= 1;
        }

        var x1 = objects[i].x;
        var y1 = objects[i].y;
        var x2 = objects[j].x;
        var y2 = objects[j].y;

        var cx = (objects[i].x + objects[j].x) / 2.0;
        var cy = (objects[i].y + objects[j].y) / 2.0;

        var dx = objects[i].x - cx;
        var dy = objects[i].y - cy;
        var d = Math.sqrt(dx * dx + dy * dy);
        var factor = (min_distance / 2.0) / d;
        objects[i].x = cx + factor * dx;
        objects[i].y = cy + factor * dy;

        dx = objects[j].x - cx;
        dy = objects[j].y - cy;
        d = Math.sqrt(dx * dx + dy * dy);
        factor = (min_distance / 2.0) / d;
        objects[j].x = cx + factor * dx;
        objects[j].y = cy + factor * dy;
      }

      num_iterations++;
      if (num_iterations >= max_iterations) break;
    }

    return objects;
  }

  return vg;

}(VG || {}));
