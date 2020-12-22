var VG = (function(vg) {

  /*
   * Provides a unified, extensible framework for visualizing results of
   * different types of HITs.
   *
   * In the backend, each type of HIT can produce JSON encoding the results of
   * an assignment of that HIT type. Correspondingly, on the frontend we need to
   * define a function for each HIT type that can render the results of an
   * assignment of that HIT type using this JSON data.
   *
   * In particular, for each HIT type we must define a function of the following
   * form:
   *
   * function RenderAssignment(div, data, image_width, options) {
   *
   * }
   *
   * Here div is a wrapper div into which the result should be drawn,
   * data is a JSON blob produced by the backend, image_width is the desired
   * width (in pixels) of any images drawn in the assignment, and options
   * is an object containing HIT-specific options.
   *
   * Once you have written such a function for a new HIT type, it must be
   * registered like this:
   *
   * VG.ViewResults.RegisterRenderingFunction('MyNewHIT', RenderAssignment);
   */

  var WORKER_RESULTS_URL = '/worker_results/';
  var ASSIGNMENT_RESULTS_URL = '/hits/assignment_results/';
  var VIEW_ASSIGNMENT_URL = '/hits/view_assignment?assignment_id=';

  vg.ViewResults = {};

  var rendering_functions = {};

  vg.ViewResults.RegisterRenderingFunction = function(type, f) {
    if (!rendering_functions.hasOwnProperty(type)) {
      rendering_functions[type] = f;
      return true;
    }
    return false;
  }

  vg.ViewResults.RenderAssignment = function(div, data, image_width, options) {
    if (rendering_functions.hasOwnProperty(data['type'])) {
      rendering_functions[data['type']](div, data, image_width, options);
    }
  }

  vg.ViewResults.RegisterRenderingFunction(
      'ConsolidateObjectsHIT',
      function(div, data, image_width) {
        alert('got here');
        var num_edges = 0;
        for (var i = 0; i < data.graph.edges.length; i++) {
          num_edges += data.graph.edges[i].length;
        }
        vg.ViewResults.renderBinaryRelationAssignment(
          div, data.image_url, image_width, data.graph,
          {draw_arrowheads: false, spread: true});    
      });

  vg.ViewResults.GetAndRenderAssignment =
    function(outer_div, assignment_id, image_width, options) {
      if (typeof(options) === 'undefined') {
        options = {};
      }
      if (typeof(options.show_links) === 'undefined') {
        options.show_links = false;
      }

      $.get(ASSIGNMENT_RESULTS_URL, {'assignment_id': assignment_id},
            function(data) {
              var div = $('<div>').addClass('assignment').appendTo(outer_div);
              var worker_url = WORKER_RESULTS_URL + data.worker_id;
              var worker_link = $('<a>').prop('href', worker_url)
                                        .text(data.worker_id);

              function show_link(text, link_text, url) {
                var link = $('<a>').prop('href', url).text(link_text);
                $('<span>').text(text)
                           .css({'display': 'block', 'text-align': 'center'}) 
                           .append(link)
                           .appendTo(div);
              }

              function show_text(text) {
                $('<span>').text(text)
                           .css({'display': 'block', 'text-align': 'center'})
                           .appendTo(div); 
              }

              if (options.show_links) {
                show_link('Assignment ID: ', assignment_id,
                          VIEW_ASSIGNMENT_URL + assignment_id);
                show_link('Worker: ', data.worker_id,
                          WORKER_RESULTS_URL + data.worker_id);
              } else {
                show_text('Assignment ID: ' + assignment_id);
                show_text('Worker: ' + data.worker_id);
              }
              show_text('Type: ' + data.type);
              show_text('Status: ' + data['status']);
              show_text('tag: ' + data.tag);

              vg.ViewResults.RenderAssignment(div, data, image_width, options);
            });
    }

  /*
   * Render the results of  a phase I assignment within some div.
   *
   * div: The div in which to render the assignment results
   * image_url: The URL of the image for the assignment
   * image_width: The width at which to render the image
   * objs: Array of objects, each with the following fields:
   *    x, y, r, name, wnid
   * color_map: An optional ColorMap object used to map wnids to colors.
   */
  // TODO: Refactor this into the Registration framework above
  vg.ViewResults.renderPhase1Assignment =
    function(div, image_url, image_width, objs, color_map) {
      if (typeof(color_map) === 'undefined') {
        var color_map = new VG.ColorMap();
      }

      var image_canvas = new VG.ImageCanvas(div, image_url, image_width, null,
        function() {
          for (var i = 0; i < objs.length; i++) {
            var obj = objs[i];
              var x = image_canvas.imageCoordsToPaperCoords(obj.x);
              var y = image_canvas.imageCoordsToPaperCoords(obj.y);
              var r = image_canvas.imageCoordsToPaperCoords(obj.r);
              var color = color_map.getColor(obj.wnid);
              (function() {
                var image_circ = new VG.CircleObject(image_canvas.getPaper(),
                                                     x, y, color, obj.name);
                image_circ.setExtent(r);
                image_circ.setCallbacks({
                  hover_in: function() { image_circ.emphasize(); },
                  hover_out: function() { image_circ.deemphasize(); }
                });
              })();
            }  
        });
    }

  /*
   * Render the results of a materials assignment within some div for the image
   * and some list for the materials.
   *
   * div: The div in which to render the image
   * materials_ul: The list to render the materials
   * image_url: URL of the image
   * image_width: Width at which to render the image
   * all_materials: Array describing all possible materials; has the form
   *    [{name: 'Wood', texture_url: 'some url'}, ... ]
   * objs: List of object to render; has the form:
   *   [
   *    {x: 10,
   *     y: 20,
   *     name: 'tree',
   *     wnid: 'n213',
   *     materials: [ {name: 'Wood', count: 1}, ... ]
   *    },
   *    ...
   *   ]
   *  The 'count' field for each material is optional.
   *
   * color_map: Optional ColorMap.
   */
  // TODO: Refactor this into the Registration framework above
  vg.ViewResults.renderMaterialAssignment =
    function(div, materials_ul, image_url, image_width, all_materials, objs,
             color_map) {
      if (typeof(color_map) === 'undefined') {
        color_map = new VG.ColorMap();
      }

      // Build a map from material names to texture urls
      var material_name_to_url = {};
      for (var i = 0; i < all_materials.length; i++) {
        var name = all_materials[i].name;
        var url = all_materials[i].texture_url;
        material_name_to_url[name] = url;
      }

      // Sort the materials for each object by the number of votes
      for (var i = 0; i < objs.length; i++) {
        objs[i].materials = objs[i].materials.sort(
            function(a, b) {
              // If either object has no count then return 0
              if (typeof(a.count) === 'undefined' ||
                  typeof(b.count) === 'undefined') {
                return 0;
              }

              if (a.count < b.count) return 1;
              if (a.count > b.count) return -1;
            return 0;
          });
      }

      var image_canvas = new VG.ImageCanvas(div, image_url, image_width, null,
          function() {
            for (var i = 0; i < objs.length; i++) {
              (function() {
                var obj = objs[i];
                var x = image_canvas.imageCoordsToPaperCoords(obj.x);
                var y = image_canvas.imageCoordsToPaperCoords(obj.y);
                var color = color_map.getColor(obj.wnid);

                var image_circ = new VG.CircleObject(image_canvas.getPaper(),
                                                     x, y, color, obj.name);
                image_circ.setExtent(0);
                image_circ.setCallbacks({
                  hover_in: function() {
                    image_circ.emphasize();
                    fillMaterialsList(obj);        
                  },
                  hover_out: function() {
                    image_circ.deemphasize();
                    clearMaterialsList();
                  }
                });
              })();
            }
          });

      function fillMaterialsList(obj) {
        for (var i = 0; i < obj.materials.length; i++) {
          var name = obj.materials[i].name;
          var count = obj.materials[i].count;
          var text = name;
          if (typeof(obj.materials[i].count) !== 'undefined') {
            text = text + ': ' + obj.materials[i].count;
          }
          var li = $('<li>').text(text).appendTo(materials_ul);
          var url = material_name_to_url[name];
          if (url) {
            li.css('background-image', 'url(' + url + ')');
          }
        }
      }

      function clearMaterialsList() {
        materials_ul.empty();
      }
    }


  /**
   * Available options:
   * draw_arrowheads: Whether to draw arrowheads. Default: true
   * spread: Whether to spread out objects before drawing. Default: false.
   */
  vg.ViewResults.renderBinaryRelationAssignment =
    function(div, image_url, image_width, triples, options) {
      if (typeof(options) === 'undefined') {
        options = {};
      }
      if (typeof(options.draw_arrowheads) === 'undefined') {
        options.draw_arrowheads = true;
      }
      if (typeof(options.spread) === 'undefined') {
        options.spread = false;
      }

      if (options.spread) {
        // Use the stupid image loading trick to get the image width before
        // rendering
        var img = new Image();
        img.onload = function() {
          var visible_image_width = image_width;
          var true_image_width = this.width;
          triples.nodes = VG.spread_out_pairs(triples.nodes,
                                              true_image_width,
                                              visible_image_width);
          render();
        }
        img.src = image_url;
      } else {
        render();
      }

      function render() {
        var image_div = $('<div>').appendTo(div);
        var objectGraph = new ObjectGraph(triples.nodes, triples.edges);  
        var colors = getColors(objectGraph.numObjectTypes);
        var paper = new Raphael(image_div.get(0), image_width);
        var clickable = false;
        var imageView = new ImageView(objectGraph.nodes, image_url, paper,
                                      colors, clickable, false, TYPE_PHASE_II,
                                      image_width, options.draw_arrowheads);
        var controller = new Controller(objectGraph, [imageView], TYPE_PHASE_II);

        var toggle = $('<input>').attr('type', 'checkbox').appendTo(div);
        toggle.click(function() {
          if (toggle.prop('checked')) {
            controller.emphEveryNode();
          } else {
            controller.deemphEveryNode();
          }
        });
      }
    }

  return vg;

}(VG || {}));
