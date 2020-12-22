var VG = (function(vg, $) {

  var CIRC_RADIUS_SMALL = 5;
  var CIRC_RADIUS_BIG = 10;
  var FONT_SIZE = 16;
  var CLICK_REGION_OPACITY = 0; // Make click regions visible for debugging

  var FADED_OPACITY = 0.4;

  function computeTextPosition(paper, x, y, name) {
    var that = (this === window ? {} : this);
    var PAD = 2;

    // Draw text beneath the circle; we'll remove it after getting its bbox
    var ty = y + CIRC_RADIUS_BIG + FONT_SIZE / 2 + 2 * PAD;
    var text = paper.text(x, ty, name);
    text.attr({'font-size': FONT_SIZE});

    var bbox = text.getBBox();
    var tbx = bbox.x - PAD;
    var tby = bbox.y - PAD;
    var tbw = bbox.width + 2 * PAD;
    var tbh = bbox.height + 2 * PAD;
    text.remove();
    
    return {
      "text": [x, ty],
       "box": [tbx, tby, tbw, tbh]
    };
  }

  var sets = [];
  var nextIdx = 0;

  vg.ImageObject = function(paper, x, y, color, name) {
    if (typeof(callbacks) === 'undefined') callbacks = {};
    var that = (this == vg ? {} : this);
    var PAD = 2;
    var emphasized = false;

    // We fake a hashmap by storing a unique index in paper._sets_idx_.
    // Then sets[paper._sets_idx_] is an object containing Raphael sets for all
    // the elements that have been created on this Raphael canvas.
    // We can use this to ensure a consistent z-order among all elements as we
    // add more ImageObjects to a canvas.
    if (typeof(paper._sets_idx_) === 'undefined') {
      paper._sets_idx_ = (nextIdx++);
      sets[paper._sets_idx_] =
        {
          circles: paper.set(),
          rects: paper.set(),
          texts: paper.set(),
          clickRegions: paper.set()
        };
    }

    // Draw the circle
    var circ = paper.circle(x, y, CIRC_RADIUS_SMALL);
    circ.attr('fill', color.hex);
    sets[paper._sets_idx_].circles.push(circ);

    // Draw text beneath the circle; make it invisible
    var ty = y + CIRC_RADIUS_BIG + FONT_SIZE / 2 + 2 * PAD;
    var text = paper.text(x, ty, name);
    text.attr({
      'opacity': 0,
       'font-size': FONT_SIZE,
       'flood-color': '#fff'
    });
    // Dirty css hacks to make the text unselectable
    $(text.node).css({
	    "-webkit-touch-callout": "none",
    	"-webkit-user-select": "none",
    	"-khtml-user-select": "none",
    	"-moz-user-select": "none",
    	"-ms-user-select": "none",
    	"user-select": "none",
    })
    sets[paper._sets_idx_].texts.push(text);

    // Draw a box around the text
    var bbox = text.getBBox();
    var tbx = bbox.x - PAD;
    var tby = bbox.y - PAD;
    var tbw = bbox.width + 2 * PAD;
    var tbh = bbox.height + 2 * PAD;
    var textBox = paper.rect(tbx, tby, tbw, tbh);
    textBox.attr({
      'stroke': '1px',
      'fill': '#fff',
      'opacity': 0
    });
    sets[paper._sets_idx_].rects.push(textBox);

    // Draw a clickregion around the circle.
    var clickRegion = paper.circle(x, y, CIRC_RADIUS_BIG);
    clickRegion.attr({
      'stroke': 'none',
      'fill': '#fff',
      'fill-opacity': CLICK_REGION_OPACITY
    });
    sets[paper._sets_idx_].clickRegions.push(clickRegion);

    // Rearrange the order
    text.toFront();
    sets[paper._sets_idx_].clickRegions.toFront();
    
    /**
     * Move this ImageObject to a specified position.
     *
     * x, y: New coordinates (in Raphael canvas coordinates) for this
     *       ImageObject.
     */
    that.moveTo = function(x, y) {
      var textPos = computeTextPosition(paper, x, y, name);
      circ.attr({'cx': x, 'cy': y});
      clickRegion.attr({'cx': x, 'cy': y});
      text.attr({'x': textPos.text[0], 'y': textPos.text[1]});
      textBox.attr({
        'x': textPos.box[0],
        'y': textPos.box[1],
      });
    }

    /**
     * Fade this object by making it partially transparant
     */
    that.fade = function() {
      circ.attr('opacity', FADED_OPACITY);
    }

    /**
     * Unfade this object by making it opaque.
     */
    that.unfade = function() {
      circ.attr('opacity', 1.0);
    }

    /**
     * Emphasize this object by making its circle bigger and showing its text
     * box.
     */
    var emphasize = function() {
      emphasized = true;
      text.animate({opacity: 1});
      textBox.animate({opacity: 1});
      circ.animate({r: CIRC_RADIUS_BIG});
    }
    that.emphasize = emphasize;

    /**
     * De-emphasize this object by making its circle smaller and removing its
     * text box.
     */
    var deemphasize = function() {
      emphasized = false;
      text.animate({opacity: 0});
      textBox.animate({opacity: 0});
      circ.animate({r: CIRC_RADIUS_SMALL});
    }
    that.deemphasize = deemphasize;

    /**
     * Toggle this object between being emphasized and de-emphasized.
     */ 
    var toggle = function() {
      if (emphasized) {
        deemphasize();
      } else {
        emphasize();
      }
    }
    that.toggle = toggle;

    /**
     * Set callbakcs for this object. Any of the following callbakcs are
     * supported:
     *
     * callbacks = {
     *   click: function() { },
     *   onmove: function(dx, dy, x, y) { },
     *   hover_in: function() { },
     *   hover_out: function() { }
     * }
     */
    var setCallbacks = function(callbacks) {
      if (typeof(callbacks.click === 'function')) {
        clickRegion.click(callbacks.click);
      }

      var has_onmove = (typeof(callbacks.onmove) === 'function');
      if (has_onmove) {
        clickRegion.drag(callbacks.onmove);
      }

      if (typeof(callbacks.hover_in === 'function') &&
          typeof(callbacks.hover_out === 'function')) {
        clickRegion.hover(callbacks.hover_in, callbacks.hover_out);
      }
    }
    that.setCallbacks = setCallbacks;

    /**
     * Remove this object from the Raphael canvas.
     */
    var remove = function() {
      circ.remove();
      textBox.remove();
      text.remove();
      clickRegion.remove();
    }
    that.remove = remove;

    /**
     * Set the color of this object.
     */
    var setColor = function(color) {
      circ.attr('fill', color.hex);
    }
    that.setColor = setColor;

    /**
     * Set the background image for this object.
     */
    var setBackgroundImage = function(image_url) {
      circ.attr('fill', "url('" + image_url + "')");
    }
    that.setBackgroundImage = setBackgroundImage;

    /**
     * Get the position of the ImageObject within the canvas.
     */
    that.getX = function() { return x; }
    that.getY = function() { return y; }

    return that;
  }

  return vg;

}(VG || {}, jQuery));
