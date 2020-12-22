var VG = (function(vg) {

  var template = [
    "<div class='container text-center'>",
    "  <div class='row'>",
    "    <div class='col-md-3 text-center'>",
    "      <h4>Relationships</h4>",
    "      <ul class='list-group'></ul>",
    "    </div>",
    "    <div class='col-md-8'></div>",
    "  </div>",
    "</div>",
  ].join('\n');

  vg.renderSingleImage = function(
    div, data, image_url, image_width, options) {
    var localTemplate = template;

    var VGViz = true;
    if (options != null && 'VGViz' in options) {
      VGViz = options['VGVIz'];
    }

    options = options || {}

    // I know, this is hacky. We need this because we use this for regions
    // and not just relationships.
    if ('title' in options) {
      localTemplate = template.replace('Relationships', options['title']);
    }

    var data_collections = vg.OpenSentences.Backbone.collectionsFromJSON(
                              data, {removeable: false});
    div.append(_.template(localTemplate));
    var ul = div.find('ul.list-group');
    var svg_div = div.find('div.col-md-8');

    var view = new vg.OpenSentences.Backbone.ReadOnlyView({
                      triples: data_collections.triples,
                      entities: data_collections.entities,
                      image_url: image_url,
                      ul: ul,
                      svg_div: svg_div,
                      scrollable: true,
                      color_by_input: true,
                      image_width: image_width,
                      VGViz: VGViz,
                   });
  };
  return vg;

}(VG || {}));
