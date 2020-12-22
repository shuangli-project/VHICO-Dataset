(function() {

  var one_list_html = [
    "<div class='container'>",
    "  <div class='row'>",
    "    <div class='col-md-3'>",
    "      <h2>Triples</h2>",
    "      <ul class='list-group triples-list'>",
    "      </ul>",
    "    </div>",
    "    <div class='col-md-9 image-div'>",
    "    </div>",
    "  </div>",
    "</div>"].join('');

  var two_list_html = [
    "<div class='container'>",
    "  <div class='row'>",
    "    <div class='col-md-3'>",
    "      <h2>Triples</h2>",
    "      <ul class='list-group triples-list'>",
    "      </ul>",
    "    </div>",
    "    <div class='col-md-3'>",
    "      <h2>Attributes</h2>",
    "      <ul class='list-group attribute-list'></ul>",
    "    </div>",
    "    <div class='col-md-6 image-div'>",
    "    </div>",
    "  </div>",
    "</div>"].join('');

  var backbone_template = [
    "<div class='container text-center'>",
    "  task depth: <%= task_depth %>",
    "  <div class='row'>",
    "    <div class='col-md-3 text-center'>",
    "      <h4>Phrases</h4>",
    "      <ul class='list-group'></ul>",
    "    </div>",
    "    <div class='col-md-8'></div>",
    "  </div>",
    "</div>",
  ].join('\n');

  function render(div, data, image_width, options) {
    if (options === undefined || options['layout'] === undefined) {
      div.append(one_list_html);
    } else if (options != undefined && options['layout'] != undefined) {
      div.append(options['layout']);
    }

    var ul = div.find('.triples-list');
    var image_div = div.find('.image-div');
    console.log(image_div.width());

    var model = VG.OpenSentences.Model.from_data(data);
    var view = new VG.OpenSentences.ReadOnlyView(
                   model,
                   data.image_url,
                   image_div,
                   ul, options);
  }

  function render_backbone(div, data, image_width, options) {
    var data_collections = VG.OpenSentences.Backbone.collectionsFromJSON(
                              data.graph, {removeable: false});
    var template = backbone_template;
    if ('template' in options) {
      template = options['template'];
    }
    div.append(_.template(template, {task_depth: data.task_depth}));
    var ul = div.find('ul.list-group');
    var svg_div = div.find('div.col-md-8');

    var view = new VG.OpenSentences.Backbone.ReadOnlyView({
                      triples: data_collections.triples,
                      entities: data_collections.entities,
                      image_url: data.image_url,
                      ul: ul,
                      svg_div: svg_div,
                      scrollable: true,
                      color_by_input: true,
                      image_width: image_width,
                   });
  }

  VG.ViewResults.RegisterRenderingFunction('OpenSentencesHIT', render);
  VG.ViewResults.RegisterRenderingFunction('NewOpenSentencesHIT', render_backbone);

}());
