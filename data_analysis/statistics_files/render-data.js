var VG = (function(vg) {

  function render_unary_triple(div, data, options) {
    var triple = [data.subject_name, data.predicate, data.object];
    var text_div = $('<div>');
    if ('VGViz' in options && options['VGViz'] == true) {
      var html = ['<a href="/VGViz/object_view?object=' + triple[0] + '">' + triple[0] + '</a>',
                  triple[1],
                  '<a href="/VGViz/attribute_view?attribute=' + triple[2] + '">' + triple[2] + '</a>'
                 ].join(' ');
      text_div.html(html);
    } else {
      var text = _.str.sprintf('%s (pk = %s)', triple.join(' '), data.pk);
      text_div.text(text)
    }
    text_div.appendTo(div);
    var svg_div = $('<div>').appendTo(div);
    var image_url = data.subject.image_url;
    var width = svg_div.width();
    if ('width' in options) width = options['width']; 
    var color_map = new VG.ColorMap();
    var image_canvas = new VG.ImageCanvas(svg_div, image_url, width, null,
        function() {
          render_obj(image_canvas, color_map, data.subject_name, data.subject);
        });
  }

  function render_binary_triple(div, data) {
    var triple = [data.subject_name, data.predicate, data.object_name];
    var text_div = $('<div>');
    if ('VGViz' in options && options['VGViz'] == true) {
      var html = ['<a href="/VGViz/object_view?object=' + triple[0] + '">' + triple[0] + '</a>',
                  '<a href="/VGViz/predicate_view?predicate=' + triple[1] + '">' + triple[1] + '</a>',
                  '<a href="/VGViz/object_view?object=' + triple[2] + '">' + triple[2] + '</a>'
                 ].join(' ');
      text_div.html(html);
    } else {
      var text = _.str.sprintf('%s (pk = %s)', triple.join(' '), data.pk);
      text_div.text(text)
    }
    text_div.appendTo(div);
    var svg_div = $('<div>').appendTo(div);
    var image_url = data.subject.image_url;
    var width = svg_div.width();
    var color_map = new VG.ColorMap();
    var image_canvas = new VG.ImageCanvas(svg_div, image_url, width, null,
      function() {
        render_obj(image_canvas, color_map, data.subject_name, data.subject);
        render_obj(image_canvas, color_map, data.object_name, data.object);
      });
  }

  function render_object(div, data) {
    var names = _.map(data.names, function(s) { return '"' + s + '"'; })
                 .join(', ');
    var text = _.str.sprintf('%s (pk = %s)', names, data.pk);
    var text_div = $('<div>').text(text).appendTo(div);
    var svg_div = $('<div>').appendTo(div);
    var color_map = new VG.ColorMap();
    var width = div.width();
    var image_canvas = new VG.ImageCanvas(svg_div, data.image_url, width, null,
        function() {
          render_obj(image_canvas, color_map, data.names[0], data);
        });
  }

  function render_judgement(div, data) {
    var names = data.names
    var text = _.str.sprintf('%s (pk = %s)', names, data.pk);
    var text_div = $('<div>').text(text).appendTo(div);
    var svg_div = $('<div>').appendTo(div);
    var color_map = new VG.ColorMap();
    var width = div.width();
    var image_canvas = new VG.ImageCanvas(svg_div, data.image, width, null,
        function() {
          render_jgmt(image_canvas, color_map, data.names, data);
        });
  }

  function render_jgmt(image_canvas, color_map, name, obj) {
    var f = image_canvas.imageCoordsToPaperCoords;
    var paper = image_canvas.getPaper();
    var color = color_map.getColor(name);
    if (!('x' in obj)) obj.x = obj.bbox.x + obj.bbox.w/2;
    if (!('y' in obj)) obj.y = obj.bbox.y + obj.bbox.h/2;
    var co = new VG.CircleObject(paper, f(obj.x+obj.w/2), f(obj.y+obj.h/2), color, name);
    co.emphasize();
    var x = f(obj.x);
    var y = f(obj.y);
    var w = f(obj.w);
    var h = f(obj.h);
    var bbox = paper.rect(x, y, w, h);
    bbox.attr({'stroke': color, 'stroke-width': 2});
    
  }

  function render_obj(image_canvas, color_map, name, obj) {
    var f = image_canvas.imageCoordsToPaperCoords;
    var paper = image_canvas.getPaper();
    var color = color_map.getColor(name);
    if (!('x' in obj)) obj.x = obj.bbox.x + obj.bbox.w/2;
    if (!('y' in obj)) obj.y = obj.bbox.y + obj.bbox.h/2;
    var co = new VG.CircleObject(paper, f(obj.x), f(obj.y), color, name);
    co.emphasize();
    if (typeof(obj.bbox) !== 'undefined') {
      var x = f(obj.bbox.x);
      var y = f(obj.bbox.y);
      var w = f(obj.bbox.w);
      var h = f(obj.bbox.h);
      var bbox = paper.rect(x, y, w, h);
      bbox.attr({'stroke': color, 'stroke-width': 2});
    }
  }

  vg.render_data = {
    render_unary_triple: render_unary_triple,
    render_binary_triple: render_binary_triple,
    render_judgement: render_judgement,
    render_object: render_object,
  };

  return vg;

}(VG || {}));
