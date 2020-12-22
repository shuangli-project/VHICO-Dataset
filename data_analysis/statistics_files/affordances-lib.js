var VG = (function(vg, $) {

  var IMAGE_WIDTH = 1000;

  function sortAffordancesByName(affordances) {
    affordances.sort(function(a, b) {
      if (a.name == 'None') return 1;
      if (b.name == 'None') return -1;
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });
    return affordances;
  }


  vg.AffordancesController = function(div, all_ul, current_ul, affordances, objects,
                                    image_url,red_cross) {
    var that = (this === vg ? {} : this);
    var disabled = true;

    // Each object will store a list of the names of its affordances
    for (var i = 0; i < objects.length; i++) {
      objects[i].affordances = [];
    }

    // Create a map from affordance name to affordance objects
    var affordance_name_to_affordance = {};
    for (var i = 0; i < affordances.length; i++) {
      affordance_name_to_affordance[affordances[i].name] = affordances[i];
    }

    // Add an index to each object
    for (var i = 0; i < objects.length; i++) {
      objects[i].index = i;
    }

    var color_factory = new VG.ColorFactory();
    var wnid_to_color = {};

    var affordance_name_to_div = {};
    affordances = sortAffordancesByName(affordances);
    buildAffordancesList(all_ul, affordances);
    
    var object_index_to_image_object = {};
    var image_canvas = new VG.ImageCanvas(div, image_url, IMAGE_WIDTH, null, 
                                          drawAllObjects);

    var current_affordance_list = [];
    var current_object_index = null;

    function affordanceClicked(affordance) {
      if (disabled) return;
      if (current_object_index === null) {
        selectAffordance(affordance);
      } else {
        var current_object = objects[current_object_index];
        toggleAffordanceForObject(affordance.name, current_object);
        drawCurrentAffordances(current_ul, current_object);
      }
    }

    function selectAffordance(affordance) {
      var should_enable = ($.inArray(affordance.name, current_affordance_list) === -1);
      // Now enable the selected affordance if it wasn't the same as the old
      // current affordance.
      if (should_enable) {
        current_affordance_list.push(affordance.name);
        affordance_name_to_div[affordance.name].addClass('selected');
      } else {
        affordance_name_to_div[affordance.name].removeClass('selected');
        var affordance_index_to_remove = current_affordance_list.indexOf(affordance.name);
        current_affordance_list.splice(affordance_index_to_remove,1);
      }
    } 

    function objectClicked(object) {
      if (disabled) return;
      if (current_affordance_list.length === 0) {
        selectObject(object);
      } else {
        for (var current_affordance_index in current_affordance_list) {
            toggleAffordanceForObject(current_affordance_list[current_affordance_index], object);
        }
        drawCurrentAffordances(current_ul, object);
      }
    }

    function selectObject(object) {
      var should_enable = (current_object_index !== object.index);

      // First disable the current object
      if (current_object_index !== null) {
        object_index_to_image_object[current_object_index].deemphasize();
        current_object_index = null;
        current_ul.empty();
      }

      if (should_enable) {
        current_object_index = object.index;
        object_index_to_image_object[object.index].emphasize();
        drawCurrentAffordances(current_ul, object);
      }
    }

    function drawCurrentAffordances(ul, object) {
      ul.empty();
      for (var i = 0; i < object.affordances.length; i++) {
          (function() {
          var affordance_name = object.affordances[i];
          var innerDiv = "<div class=\"affordance_name\">" + affordance_name + "</div><img class=\"red_cross\" src=" + red_cross + ">";
          var div = document.createElement('li');
          div.innerHTML = innerDiv;
	  div.id = 'curr' + affordance_name;
          div.className = 'affordance-obj-curr';
          ul.append(div);
	  var divObj = $('#curr'+affordance_name);
          divObj.click(function() {
            toggleAffordanceForObject(affordance_name, object);
            drawCurrentAffordances(ul, object);
          });
	})();
      }
    }

    function toggleAffordanceForObject(affordance_name, object) {
      var idx = $.inArray(affordance_name, object.affordances);
      if (idx === -1) {
        // Affordance was not found, so add it.
        object.affordances.push(affordance_name);
        object.affordances.sort();
      } else {
        // Affordance was found, so remove it.
        object.affordances.splice(idx, 1);
      }

      // If the object has a nonempty affordances list then we fade it; otherwise
      // we unfade it.
      var io = object_index_to_image_object[object.index];
      if (object.affordances.length > 0) {
        io.fade();
      } else {
        io.unfade();
      }
    }

    function drawAllObjects() {
      for (var i = 0; i < objects.length; i++) {
        drawObject(objects[i]);
      }
    }

    function drawObject(object) {
      var x = image_canvas.imageCoordsToPaperCoords(object.x);
      var y = image_canvas.imageCoordsToPaperCoords(object.y);
      var wnid = object.wnid;

      // If the object doesn't have a wnid then use the name to select a color instead
      if (!wnid) {
        wnid = object.name;
      }

      if (!wnid_to_color.hasOwnProperty(wnid)) {
        wnid_to_color[wnid] = color_factory.nextColor();
      }
      var color = wnid_to_color[wnid];
      var name = object.name;
      var paper = image_canvas.getPaper();
      var io = new VG.ImageObject(paper, x, y, color, name);
      io.setCallbacks({
        'hover_in': function() {
          if (current_object_index !== object.index) {
            io.emphasize();
          }
          if (current_object_index === null) {
            drawCurrentAffordances(current_ul, object);
          }
        },
        'hover_out': function() {
          if (current_object_index !== object.index) {
            io.deemphasize();
          }
          if (current_object_index === null) {
            current_ul.empty();
          }
        },
        'click': function() {
          objectClicked(object);
        }
      });
      object_index_to_image_object[object.index] = io;
    }

    function buildAffordancesList(ul, affordances) {
      for (var i = 0; i < affordances.length; i++) {
        (function() {
          var affordance = affordances[i];
	  var innerDiv = "<div class=\"affordance-description\">" + affordance.description + "</div><img class=\"affordance-image\" src=\"" + affordance.texture_url + "\"> <div class=\"affordance_name\">" + affordance.name + "</div>";
          var div = document.createElement('div');
          div.innerHTML = innerDiv;
	  div.className = 'affordance-obj';
	  div.id = affordance.name;
          ul.append(div);
	  var divObj = $('#'+affordance.name);
          affordance_name_to_div[affordance.name] = divObj;
          divObj.click(function() {
            affordanceClicked(affordance);
          });
        })();
      }
    }

    that.enable = function() { disabled = false; }
    that.disable = function() { disabled = true; }

    that.getObjects = function() {
      // Return a deep copy
      return $.extend(true, [], objects);
    }

    that.showUnlabeledObjects = function() {
      for (var i = 0; i < objects.length; i++) {
        if (objects[i].affordances.length === 0) {
          (function() {
            var io = object_index_to_image_object[objects[i].index];
            io.emphasize();
            window.setTimeout(function() { io.deemphasize(); }, 500);
          })();
        }
      }
    }

    return that;
  }

  return vg;

}(VG || {}, jQuery));
