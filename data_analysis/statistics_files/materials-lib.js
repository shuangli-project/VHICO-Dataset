var VG = (function(vg, $) {
 
  var IMAGE_WIDTH = 1000;

  function sortMaterialsByName(materials) {
    materials.sort(function(a, b) {
      // Special case: 'Other' goes at the end
      if (a.name === 'Other') return 1;
      if (b.name === 'Other') return -1;

      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });
    return materials;
  }


  vg.MaterialsController = function(div, all_ul, current_ul, materials, objects,
                                    image_url) {
    var that = (this === vg ? {} : this);
    var disabled = true;

    // Each object will store a list of the names of its materials
    for (var i = 0; i < objects.length; i++) {
      objects[i].materials = [];
    }

    // Create a map from material name to material objects
    var material_name_to_material = {};
    for (var i = 0; i < materials.length; i++) {
      material_name_to_material[materials[i].name] = materials[i];
    }

    // Add an index to each object
    for (var i = 0; i < objects.length; i++) {
      objects[i].index = i;
    }

    var color_factory = new VG.ColorFactory();
    var wnid_to_color = {};

    var material_name_to_li = {};
    materials = sortMaterialsByName(materials);
    buildMaterialsList(all_ul, materials);
    
    var object_index_to_image_object = {};
    var image_canvas = new VG.ImageCanvas(div, image_url, IMAGE_WIDTH, null, 
                                          drawAllObjects);

    var current_material_list = [];
    var current_object_index = null;

    function materialClicked(material) {
      if (disabled) return;
      if (current_object_index === null) {
        selectMaterial(material);
      } else {
        var current_object = objects[current_object_index];
        toggleMaterialForObject(material.name, current_object);
        drawCurrentMaterials(current_ul, current_object);
      }
    }

    function selectMaterial(material) {
      var should_enable = ($.inArray(material.name, current_material_list) === -1);

      // current material.
      if (should_enable) {
        current_material_list.push(material.name);
        material_name_to_li[material.name].addClass('selected');
      } else {
        material_name_to_li[material.name].removeClass('selected');
        var material_index_to_remove = current_material_list.indexOf(material.name);
        current_material_list.splice(material_index_to_remove,1);
      }
    } 

    function objectClicked(object) {
      if (disabled) return;
      if (current_material_list.length === 0) {
        selectObject(object);
      } else {
        for (var current_material_index in current_material_list) {
            toggleMaterialForObject(current_material_list[current_material_index], object);
        }
        drawCurrentMaterials(current_ul, object);
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
        drawCurrentMaterials(current_ul, object);
      }
    }

    function drawCurrentMaterials(ul, object) {
      ul.empty();
      for (var i = 0; i < object.materials.length; i++) {
        (function() {
          var material_name = object.materials[i];
          var material = material_name_to_material[material_name];
          var li = $('<li>').text(material_name).appendTo(ul);
          if (material.texture_url) {
            li.css('background-image', 'url(' + material.texture_url + ')');
          }
          li.click(function() {
            toggleMaterialForObject(material_name, object);
            drawCurrentMaterials(ul, object);
          });
        })();
      }
    }

    function toggleMaterialForObject(material_name, object) {
      var idx = $.inArray(material_name, object.materials);
      if (idx === -1) {
        // Material was not found, so add it.
        object.materials.push(material_name);
        object.materials.sort();
      } else {
        // Material was found, so remove it.
        object.materials.splice(idx, 1);
      }

      // If the object has a nonempty materials list then we fade it; otherwise
      // we unfade it.
      var io = object_index_to_image_object[object.index];
      if (object.materials.length > 0) {
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
            drawCurrentMaterials(current_ul, object);
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

    function buildMaterialsList(ul, materials) {
      // window.console.log(materials);
      for (var i = 0; i < materials.length; i++) {
        (function() {
          var material = materials[i];
          var li = $('<li>').text(material.name).appendTo(ul);
          material_name_to_li[material.name] = li;
          if (material.texture_url) {
            li.css('background-image', 'url(' + material.texture_url + ')');
          }
          li.click(function() {
            materialClicked(material);
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
        if (objects[i].materials.length === 0) {
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
