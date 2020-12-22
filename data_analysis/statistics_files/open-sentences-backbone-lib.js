var VG = (function(vg) {

  // Map between entities and triples
  var ET_map = {};
  // Map between triples and tripleViews, one-to-one
  var TV_array = [];
  /*
  // Map between entites and regions
  var ER_map = {};
  // Map between regions and regionViews, one-to-one
  var RV_array = [];
  */
    
  var UNARY_PREDICATES = [
    'is', 'are', 'is a', 'is an', 'are a', 'are an',
    'looks', 'looks like',
  ];

  var Entity = Backbone.Model.extend({
    defaults: {
      removeable: true,
      name: null,
      bbox_x: null,
      bbox_y: null,
      bbox_w: null,
      bbox_h: null,
      judgement: null,
      expert_judgement: null,
      expert_notes: null,
      alternate_names: null,
    },

    initialize: function(attributes, options) {
      // If we set alternate_names to have the default of [] above then
      // the same array instance gets reused for all Entity instances.
      // To avoid this we explicitly construct a new array instance here.
      if (this.get('alternate_names') === null) {
        this.set({'alternate_names': []});
      }
    },

    get_centroid_x: function() {
      var bbox_x = this.get('bbox_x');
      var bbox_w = this.get('bbox_w');
      if (bbox_x !== null && bbox_w !== null) return bbox_x + bbox_w / 2;
      return null;
    },

    get_centroid_y: function() {
      var bbox_y = this.get('bbox_y');
      var bbox_h = this.get('bbox_h');
      if (bbox_y !== null && bbox_h !== null) return bbox_y + bbox_h / 2;
      return null;
    },

    has_bbox: function() {
      return this.get('bbox_x') !== null;
    },

    clear_bbox: function() {
      this.set({bbox_x: null, bbox_y: null, bbox_w: null, bbox_h: null});
    },
    
    add_alternate_name: function(alt_name) {
      console.log(this);
      console.log(alt_name);
      if (_.indexOf(this.get('alternate_names'), alt_name) === -1) {
        this.get('alternate_names').push(alt_name);
      }
    },
    
    overlap_over_union: function(other) {
      if (!this.has_bbox() || !other.has_bbox()) return null;
      var x1 = Math.max(this.get('bbox_x'), other.get('bbox_x'));
      var x2 = Math.min(this.get('bbox_x') + this.get('bbox_w'),
                        other.get('bbox_x') + other.get('bbox_w'));
      var y1 = Math.max(this.get('bbox_y'), other.get('bbox_y'));
      var y2 = Math.min(this.get('bbox_y') + this.get('bbox_h'),
                        other.get('bbox_y') + other.get('bbox_h'));
      if (x1 > x2 || y1 > y2) return 0;
      var a1 = this.get('bbox_w') * this.get('bbox_h');
      var a2 = other.get('bbox_w') * other.get('bbox_h');
      var o = (x2 - x1) * (y2 - y1);
      var iou = o / (a1 + a2 - o);
      return iou;
    },
  });

var Region = Backbone.Model.extend({
    defaults: {
      phrase: null,
      bbox_x: null,
      bbox_y: null,
      bbox_w: null,
      bbox_h: null,
    },

    initialize: function(attributes, options) {
      
    },

    get_centroid_x: function() {
      var bbox_x = this.get('bbox_x');
      var bbox_w = this.get('bbox_w');
      if (bbox_x !== null && bbox_w !== null) return bbox_x + bbox_w / 2;
      return null;
    },

    get_centroid_y: function() {
      var bbox_y = this.get('bbox_y');
      var bbox_h = this.get('bbox_h');
      if (bbox_y !== null && bbox_h !== null) return bbox_y + bbox_h / 2;
      return null;
    },

    has_bbox: function() {
      return this.get('bbox_x') !== null;
    },
  });
  // Can pass the following to the constructor:
  // triples: a Triples collection; Entities will watch for remove events from
  //          this triple collection and remove any orphaned entities.
  var Entities = Backbone.Collection.extend({
    model: Entity,

    initialize: function(models, options) {
      if (options) _.extend(this, _.pick(options, 'triples'));

      if (this.triples) {
        this.triples.on('remove', this.prune, this);
      }
    },

    /**
     * Remove Entities that are not referenced by any of the Triples in
     * this.triples. Does not remove an Entity if it has a property
     * do_not_delete set to true.
     */
    prune: function() {
      var mentioned = {};
      
      this.each(function(e) {
        if (e.do_not_delete) mentioned[e.cid] = true;
      });

      this.triples.each(function(t) {
        var sid = t.get('subject').cid;
        mentioned[sid] = true;
        if (t.type === 'binary') {
          var oid = t.get('object').cid;
          mentioned[oid] = true;
        }
      });
      $('body').off(this.keypress_event_name);
      var to_remove = this.filter(function(e) {
        return !_.has(mentioned, e.cid);
      });
      this.remove(to_remove);
    },
  });

  var Regions = Backbone.Collection.extend({
    model: Region,

    initialize: function(models, options) {
    },
  });

  /**
   * Expects the following attributes:
   * subject: an Entity
   * predicate: a String
   * object: an Entity
   */ 
  var BinaryTriple = Backbone.Model.extend({
    defaults: {
      removeable: true,
      judgement: null,
      expert_judgement: null,
      expert_notes: null,
      subject_text: null,
      object_text: null,
      region_text: null,
    },
    type: 'binary',
    text_triple: function() {
      var s = this.get('subject_text');
      if (s === null) s = this.get('subject').get('name');

      var p = this.get('predicate');

      var o = this.get('object_text');
      if (o === null) o = this.get('object').get('name');
      return [s, p, o];
    },
    text: function() {
      return this.text_triple().join(' - ');
    },
    get_region_text: function() {
      return this.get('region_text');
    },
    get_target: function() {
      if (!this.get('subject').has_bbox()) {
        return 'subject';
      } else if (!this.get('object').has_bbox()) {
        return 'object';
      }
      return null;
    },
    equals: function(other) {
      if (other.type !== this.type) return false;
      var same_s = (this.get('subject').cid === other.get('subject').cid);
      var same_p = (this.get('predicate') === other.get('predicate'));
      var same_o = (this.get('object').cid === other.get('object').cid);
      return (same_s && same_p && same_o);
    },
  });


  /**
   * Expects the following attributes:
   * subject: an Entity
   * predicate: a String
   * attribute: a String
   */
  var UnaryTriple = Backbone.Model.extend({
    defaults: {
      removeable: true,
      judgement: null,
      expert_judgement: null,
      expert_notes: null,
      subject_text: null,
      region_text: null,
    },
    type: 'unary',
    text_triple: function() {
      var s = this.get('subject_text');
      if (s === null) s = this.get('subject').get('name');
      var p = this.get('predicate');
      var o = this.get('attribute');
      return [s, p, o];
    },
    text: function() {
      return this.text_triple().join(' - ');
    },
    get_region_text: function() {
      return this.get('region_text');
    },
    get_target: function() {
      if (!this.get('subject').has_bbox()) {
        return 'subject';
      }
      return null;
    },
    equals: function(other) {
      if (other.type !== this.type) return false;
      var same_s = (this.get('subject').cid === other.get('subject').cid);
      var same_p = (this.get('predicate') === other.get('predicate'));
      var same_a = (this.get('attribute') === other.get('attribute'));
      return (same_s && same_p && same_a);
    },
  });


  var Triples = Backbone.Collection.extend({

    model: function(attrs, options) {
      if (_.has(attrs, 'object')) {
        return new BinaryTriple(attrs, options);
      } else if (_.has(attrs, 'attribute')) {
        return new UnaryTriple(attrs, options);
      }
    },

    // Triples that have a primary key (pk) set are assumed to have been passed
    // from the backend. Triples without a primary key are newly created.
    get_new_unary: function() {
      return this.filter(function(t) {
        return t.type === 'unary' && !t.has('pk');
      });
    },

    get_unary: function() {
      return this.filter(function(t) { return t.type === 'unary'; });
    },

    get_binary: function() {
      return this.filter(function(t) { return t.type === 'binary'; });
    },

    get_new_binary: function() {
      return this.filter(function(t) {
        return t.type === 'binary' && !t.has('pk');
      });
    },
  });


  function collectionsToJSON(entities, triples) {
    var cid_to_idx = {};
    var objects = [];
    entities.each(function(e, i) {
      cid_to_idx[e.cid] = i;
      console.log(e);
      var obj_json = {
        'names': [e.get('name')].concat(e.get('alternate_names')),
        'bbox': {
          x: Math.round(e.get('bbox_x')),
          y: Math.round(e.get('bbox_y')),
          w: Math.round(e.get('bbox_w')),
          h: Math.round(e.get('bbox_h')),
        },
      };
      var optional_fields = [
        'pk', 'judgement', 'expert_judgement', 'expert_notes'
      ];
      _.each(optional_fields, function(f) {
        if (e.has(f)) obj_json[f] = e.get(f);
      });
      // var pk = e.get('pk');
      // if (pk) obj_json.pk = pk;
      objects.push(obj_json);
    });

    var binary_triples = [];
    var unary_triples = [];
    triples.each(function(t) {
      var t_json = {
        'subject': cid_to_idx[t.get('subject').cid],
        'predicate': t.get('predicate'),
        'text': t.text_triple(),
      };
      var optional_fields = [
        'pk', 'judgement', 'expert_judgement', 'expert_notes',
      ];
      _.each(optional_fields, function(f) {
        if (t.has(f)) t_json[f] = t.get(f);
      });
      // var pk = t.get('pk');
      // if (pk) t_json.pk = pk;
      if (t.type === 'unary') {
        t_json.object = t.get('attribute');
        unary_triples.push(t_json);
      } else if (t.type === 'binary') {
        t_json.object = cid_to_idx[t.get('object').cid];
        binary_triples.push(t_json);
      }
    });

    return {
      'objects': objects,
      'binary_triples': binary_triples,
      'unary_triples': unary_triples,
    };
  }

  function collectionsFromJSON(data, options) {
    var removeable = true;
    if (options && _.has(options, 'removeable')) removeable = options.removeable;

    var triples = new Triples();
    var entities = new Entities([], {triples: triples});

    var idx_to_cid = {};
    _.each(data.objects, function(o, i) {
      name_set = new Set(o.names);
      o.names = name_set.values().next().value;  // assuming one name per entity
      var e = entities.add({
                name: new Set(o.names),
                alternate_names: o.names.slice(1),
                bbox_x: o.bbox.x,
                bbox_y: o.bbox.y,
                bbox_w: o.bbox.w,
                bbox_h: o.bbox.h,
                removeable: removeable,
              });
      var optional_args = [
        'pk', 'judgement', 'expert_judgement', 'expert_notes', 'input',
      ];
      _.each(optional_args, function(f) {
        if (_.has(o, f)) e.set(_.pick(o, f));
      });
      // if (o.pk) e.set({pk: o.pk});
      // if (o.input) e.set({input: o.input});
      idx_to_cid[i] = e.cid;
    });

    _.each(data.binary_triples, function(t) {
      var tt = triples.add({
        subject: entities.get(idx_to_cid[t.subject]),
        predicate: t.predicate,
        object: entities.get(idx_to_cid[t.object]),
        removeable: removeable,
      });
      var optional_args = [
        'pk', 'input', 'judgement', 'expert_judgement', 'expert_notes',
      ];
      _.each(optional_args, function(f) {
        if (_.has(t, f)) tt.set(_.pick(t, f))
      });
      // Special case for subject_text and object_text
      if (t.text[0] !== tt.get('subject').get('name')) {
        tt.set({'subject_text': t.text[0]});
      }
      if (t.text[2] !== tt.get('object').get('name')) {
        tt.set({'object_text': t.text[2]});
      }
    });

    _.each(data.unary_triples, function(t) {
      var tt = triples.add({
        subject: entities.get(idx_to_cid[t.subject]),
        predicate: t.predicate,
        attribute: t.object,
        removeable: removeable,
      });
      if (t.pk) tt.set({pk: t.pk});
      if (t.input) tt.set({input: t.input});
      if (t.text[0] !== tt.get('subject').get('name')) {
        tt.set({'subject_text': t.text[0]});
      }
    });

    //entities.prune();

    return {
      entities: entities,
      triples: triples,
    };
  }

  // generate triples from JSON
  // build a map between entities and triples
  // also build a map between entites and regions
  function parseTriples(data, options) {
    var removeable = true;
    if (options && _.has(options, 'removeable')) removeable = options.removeable;

    var triples = new Triples();
    var entities = new Entities([], {triples: triples});
    var idx_to_cid = {};
    _.each(data.objects, function(o, i) {
      name_set = new Set(o.names);
      o.names = name_set.values().next().value;  // assuming one name per entity
      var e = entities.add({
                name: o.names,
                alternate_names: o.names.slice(1),
                bbox_x: o.bbox.x,
                bbox_y: o.bbox.y,
                bbox_w: o.bbox.w,
                bbox_h: o.bbox.h,
                removeable: removeable,
              });
      var optional_args = [
        'pk', 'judgement', 'expert_judgement', 'expert_notes', 'input',
      ];
      _.each(optional_args, function(f) {
        if (_.has(o, f)) e.set(_.pick(o, f));
      });
      // if (o.pk) e.set({pk: o.pk});
      // if (o.input) e.set({input: o.input});
      idx_to_cid[i] = e.cid;

      // setup proper structure for the entity-triple map
      ET_map[i] = [];
      ET_map[i].cid = e.cid;
    });

    _.each(data.binary_triples, function(t, i) {
      var tt = triples.add({
        subject: entities.get(idx_to_cid[t.subject]),
        predicate: t.predicate,
        object: entities.get(idx_to_cid[t.object]),
        removeable: removeable,
        region: data.regions[t.region].phrase,
      });

      tt.set({'region_text': data.regions[t.region].phrase});
      var optional_args = [
        'pk', 'input', 'judgement', 'expert_judgement', 'expert_notes',
      ];
      _.each(optional_args, function(f) {
        if (_.has(t, f)) tt.set(_.pick(t, f))
      });
      // Special case for subject_text and object_text
      if (t.text[0] !== tt.get('subject').get('name')) {
        tt.set({'subject_text': t.text[0]});
      }
      if (t.text[2] !== tt.get('object').get('name')) {
        tt.set({'object_text': t.text[2]});
      }
      
      // gather triples corrosponding to each entity
      ET_map[t.subject].push(tt);
      ET_map[t.object].push(tt);

    });

    _.each(data.unary_triples, function(t) {
      var tt = triples.add({
        subject: entities.get(idx_to_cid[t.subject]),
        predicate: t.predicate,
        attribute: t.object,
        removeable: removeable,
        region: data.regions[t.region].phrase,
      });

      tt.set({'region_text': data.regions[t.region].phrase});
      if (t.pk) tt.set({pk: t.pk});
      if (t.input) tt.set({input: t.input});
      if (t.text[0] !== tt.get('subject').get('name')) {
        tt.set({'subject_text': t.text[0]});
      }

      ET_map[t.subject].push(tt);

    });
    //entities.prune();

    /*
    // Also setup the structure for the entity-region map
    // We only emphasize the entities contained in relationships
    for (i = 0; i < entities.length; i++){
    	ER_map[i] = [];
    	ER_map[i].cid = entities.models[i].cid;
    	ER_map[i].e = entities.models[i];
    }
    */

    return {
      entities: entities,
      triples: triples,
    };
  }

  function regionsFromJSON(data, options) {

    var regions = new Regions([]);

    var idx_to_cid = {};
    _.each(data, function(o, i) {
      var r = regions.add({
                phrase: o.phrase,
                bbox_x: o.x,
                bbox_y: o.y,
                bbox_w: o.w,
                bbox_h: o.h,
              });
    });
    //entities.prune();
    return regions;
  }

  // generate regions from JSON
  // populate the entity-region map 
  function parseRegions(data, options) {

    var regions = new Regions([]);

    var idx_to_cid = {};
    _.each(data, function(o, i) {
      var r = regions.add({
                phrase: o.phrase,
                bbox_x: o.x,
                bbox_y: o.y,
                bbox_w: o.w,
                bbox_h: o.h,
              }); 

      // gather regions corrosponding to each entity
      // only check if phrase contains word, hence does not distinguish two different
      // entities with the same name
      for (j = 0; j < Object.keys(ER_map).length; j++){
      	if (r.attributes.phrase.indexOf(ER_map[j].e.attributes.name) >= 0){
      		ER_map[j].push(r);
      	}
      }
    });
    //entities.prune();
   
    return regions;
  }
      

  /*
   * Must pass collection as a Triples
   */
  var TripleListView = Backbone.View.extend({

    tagName: 'ul',
    className: 'list-group',

    initialize: function(options) {
      if (options) _.extend(this, _.pick(options, ['color_by_input', 'VGViz']));

      var that = this;
      this._triple_views = [];
      this.collection.each(_.partial(this.add, _, true), this);

      this.collection.bind('add', this.add, this);
      this.collection.bind('remove', this.remove, this);
      this.render();
    },

    add: function(triple) {
      var tv = new TripleListElemView({
        model: triple,
        collection: this.collection,
        color_by_input: this.color_by_input,
        VGViz: this.VGViz,
      });

      this._triple_views.push(tv);

      if (this._rendered) {
        this.$el.append(tv.render().$el);
      }
    },

    remove: function(triple) {
      var view_to_remove = _.find(this._triple_views, function(tv) {
                                    return tv.model === triple;
                                  });
      this._triple_views = _.without(this._triple_views, view_to_remove);

      view_to_remove.remove();
    },

    render: function() {
      this._rendered = true;
      this.$el.empty();
 
      var that = this;
      _.each(this._triple_views, function(tv) {
        that.$el.append(tv.render().$el);
      });

      return this;
    },
  });

  var RegionListView = Backbone.View.extend({

    tagName: 'ul',
    className: 'list-group',

    initialize: function(options) {
      if (options) _.extend(this, _.pick(options, ['color_by_input', 'VGViz']));

      var that = this;
      this._region_views = [];
      this.collection.each(_.partial(this.add, _, true), this);

      this.collection.bind('add', this.add, this);
      this.collection.bind('remove', this.remove, this);

      this.render();
    },

    add: function(region) {
      var tv = new RegionListElemView({
        model: region,
        collection: this.collection,
        color_by_input: this.color_by_input,
        VGViz: this.VGViz,
      });

      this._region_views.push(tv);
      tv.hide();

      if (this._rendered) {
        this.$el.append(tv.render().$el);
      }
    },

    remove: function(region) {
      var view_to_remove = _.find(this._region_views, function(tv) {
                                    return tv.model === region;
                                  });
      this._region_views = _.without(this._region_views, view_to_remove);

      view_to_remove.remove();
    },

    render: function() {
      this._rendered = true;
      this.$el.empty();
 
      var that = this;
      _.each(this._region_views, function(tv) {
        that.$el.append(tv.render().$el);
      });

      return this;
    },
  });

  /**
   * Must pass model (which is a triple), and collection (Triples)
   */
  var TripleListElemView = Backbone.View.extend({

    tagName: 'li',
    className: 'list-group-item',

    // This is a dirty hack; it would be much better to load the template
    // from an external file.
    html: ["<button class='close'>",
           "  <span class='glyphicon glyphicon-remove'></span>",
           "</button>"].join('\n'),

    events: {
      'click button': 'remove_clicked',
      'hover li': 'hover_handler',
      'mouseenter li': 'mouse_in',
      'mouseover li': 'mouse_in',
    },

    initialize: function(options) {
      if (options) _.extend(this, _.pick(options, ['color_by_input', 'VGViz']));
      this.model.vid = this.cid;
      //this.render();
    },

    render: function() {
      if (this.VGViz) {
        s_p_o = this.model.text_triple();
        triple_html = ["<a href='object_view?object=" + s_p_o[0] + "'>" + s_p_o[0] + "</a>",
                       " - <a href='predicate_view?predicate=" + s_p_o[1] + "'>" + s_p_o[1] + "</a>",
                       " - <a href='object_view?object=" + s_p_o[2] + "'>" + s_p_o[2] + "</a>",
                      ].join('');
        if (s_p_o[1] == 'is') {
          triple_html = ["<a href='object_view?object=" + s_p_o[0] + "'>" + s_p_o[0] + "</a>",
                         " - " + s_p_o[1] + "</a>",
                         " - <a href='attribute_view?attribute=" + s_p_o[2] + "'>" + s_p_o[2] + "</a>",
                      ].join('');
        }
        this.$el.append(triple_html);
        

      } else {
        // insert proper phrase for each triples
        // currently only done for relationships because the phrase
        // for attributes is the same as the triple itself!
        // aesthetic improvements pending...
        
        var text = this.model.text();
        text = text + "<br /><span style='font-size:10px; color:black'>" + this.model.get_region_text() + "</span>";
        this.$el.html(text);
      } 

      
      if (this.model.get('removeable')) {
        // var template = _.template($('#close-button').html(), {});
        var template = _.template(this.html);
        this.$el.append(template);
      }


      if (this.color_by_input) {
        if (this.model.get('input')) {
          this.$el.css({
            'background-color': '#eee',
          });
        } 
      }
      
      // manually wire hover event
      this.$el.hover(_.bind(this.trigger_hover, this, 'emphasize'),
                     _.bind(this.trigger_remove_hover, this, 'deemphasize'));

      TV_array.push(this);
      return this;
    },

    remove_clicked: function() {
      this.trigger_entity_event('deemphasize');
      this.collection.remove(this.model);
    },

     trigger_hover: function(e) {
      this.model.get('subject').trigger(e);
      if (this.model.type === 'binary') {
        this.model.get('object').trigger(e);
      }
      this.$el.css({"background-color": "D3D3D3"}); 
    },

    trigger_remove_hover: function(e) {
      this.model.get('subject').trigger(e);
      if (this.model.type === 'binary') {
        this.model.get('object').trigger(e);
      }
      this.$el.css({"background-color": "#fff"})
    },

  });


  var HideableView = Backbone.View.extend({
    hide: function() {
      this.$el.addClass('hidden');
    },
    show: function() {
      this.$el.removeClass('hidden');
    },
  });

  var RegionListElemView = HideableView.extend({

    tagName: 'li',
    className: 'list-group-item',

    // This is a dirty hack; it would be much better to load the template
    // from an external file.
    html: ["<button class='close'>",
           "  <span class='glyphicon glyphicon-remove'></span>",
           "</button>"].join('\n'),

    events: {
      'hover li': 'hover_handler',
      'mouseenter li': 'mouse_in',
      'mouseover li': 'mouse_in',
    },

    initialize: function(options) {
      if (options) _.extend(this, _.pick(options, ['color_by_input', 'VGViz']));
      this.model.vid = this.cid;
      //this.render();
    },

    render: function() {
      triple_html = this.model.attributes.phrase;
      this.$el.append(triple_html);
      if (this.color_by_input) {
        if (this.model.get('input')) {
          this.$el.css({
            'background-color': '#eee',
          });
        } 
      }
      // manually wire hover event
      this.$el.hover(_.bind(this.trigger_hover, this, 'emphasize'),
                     _.bind(this.trigger_remove_hover, this, 'deemphasize'));
      RV_array.push(this);
      return this;
    },

    remove_clicked: function() {
      this.trigger_entity_event('deemphasize');
      this.collection.remove(this.model);
    },

    trigger_hover: function(e) {
      this.model.trigger(e);
      this.show();
      this.$el.css({"background-color": "D3D3D3"}); 
    },

    trigger_remove_hover: function(e) {
      this.model.trigger(e);
      this.$el.css({"background-color": "#fff"})
      this.hide();
    },
  });

  /**
   * This expects to be passed a collection of Entities
   */
  var SvgView = HideableView.extend({
    initialize: function(options) {
      var valid_options = ['image_url', 'image_width', 'image_height',
                           'image_opacity'];
      _.extend(this, _.pick(options, valid_options));

      var canvas_size = this.max_image_width;
      if (_.has(this, 'image_height')) {
        canvas_size = {
          max_width: this.image_width,
          max_height: this.image_height,
        };
      }  

      var canvas_options = {'image_opacity': this.image_opacity};
      this.image_canvas = new VG.ImageCanvas(this.$el,
                                             this.image_url,
                                             canvas_size,
                                             null,
                                             _.bind(this.init_canvas, this),
                                             canvas_options);
      this.child_views = [];
      this.color_map = new VG.ColorMap();

    },

    add: function(model) {
      var color = this.color_map.getColor(model.get('name'));
      var child_view = new SvgElemView({model: model,
                                        image_canvas: this.image_canvas,
                                        color: color});
      this.listenTo(child_view, 'dot-clicked',
                    _.bind(this.trigger, this, 'dot-clicked', child_view.model));
      this.child_views.push(child_view);
    },

    remove: function(model) {
      for (var i = 0; i < this.child_views.length; i++) {
        if (this.child_views[i].model === model) {
          this.child_views[i].remove();
          this.child_views.splice(i, 1);
          return;
        }
      }
    },

    init_canvas: function() {
      this.collection.each(this.add, this);

      this.collection.bind('add', this.add, this);
      this.collection.bind('remove', this.remove, this);

      this.trigger('got-height', this.$el.height());

      this.image_canvas.click(_.bind(this.trigger, this, 'image-clicked'));
      this.trigger('canvas-loaded');
    },
  });

  /*
  Customized version to render both relationships and regions
  */
  var CombinedSvgView = HideableView.extend({
    initialize: function(options) {
      var valid_options = ['image_url', 'image_width', 'image_height',
                           'image_opacity'];
      _.extend(this, _.pick(options, valid_options));

      var canvas_size = this.max_image_width;
      if (_.has(this, 'image_height')) {
        canvas_size = {
          max_width: this.image_width,
          max_height: this.image_height,
        };
      }  

      var canvas_options = {'image_opacity': this.image_opacity};
      this.image_canvas = new VG.ImageCanvas(this.$el,
                                             this.image_url,
                                             canvas_size,
                                             null,
                                             _.bind(this.init_canvas, this),
                                             canvas_options);
      this.child_views = [];
      this.color_map = new VG.ColorMap();

    },

    add: function(model) {
      var color = this.color_map.getColor(model.get('name'));
      var circle_view = true;
      if (model instanceof Region){
        circle_view = false;
      }
      var child_view = new CombinedSvgElemView({model: model,
                                        image_canvas: this.image_canvas,
                                        color: color,
                                        circle_view: circle_view});
      if (circle_view){
        this.listenTo(child_view, 'dot-clicked',
                    _.bind(this.trigger, this, 'dot-clicked', child_view.model));
      }
      this.child_views.push(child_view);
    },

    remove: function(model) {
      for (var i = 0; i < this.child_views.length; i++) {
        if (this.child_views[i].model === model) {
          this.child_views[i].remove();
          this.child_views.splice(i, 1);
          return;
        }
      }
    },

    init_canvas: function() {

      this.collection.each(this.add, this);

      this.collection.bind('add', this.add, this);
      this.collection.bind('remove', this.remove, this);
      
      this.trigger('got-height', this.$el.height());

      this.image_canvas.click(_.bind(this.trigger, this, 'image-clicked'));
      this.trigger('canvas-loaded');
    },
  });

  var CombinedSvgElemView = Backbone.View.extend({
    initialize: function(options) {
      _.extend(this, _.pick(options, 'image_canvas', 'color','circle_view'));
      this.render();
    },

    render: function() {
      var f = this.image_canvas.imageCoordsToPaperCoords;
      var paper = this.image_canvas.getPaper();
      var cx = Math.round(f(this.model.get_centroid_x()));
      var cy = Math.round(f(this.model.get_centroid_y()));
      
      if (this.circle_view){
      this.circle_object = new VG.CircleObject(paper, cx, cy, this.color,
                                               this.model.get('name'));
      this.circle_object.setExtent(0);
      this.circle_object.setCallbacks({
        hover_in: _.bind(this.model.trigger, this.model, 'circle_emphasize'),
        hover_out: _.bind(this.model.trigger, this.model, 'circle_deemphasize'),
        click: _.bind(this.trigger, this, 'dot-clicked'),
      });

    } else{
      this.circle_object = new VG.CircleObject(paper, cx, cy, this.color,
                                               this.model.attributes.phrase);
      this.circle_object.setExtent(0);
      this.circle_object.hide();
    }
    this.listenTo(this.model, 'emphasize', this.emphasize);
    this.listenTo(this.model, 'deemphasize', this.deemphasize);
    this.listenTo(this.model, 'circle_emphasize', this.circle_emphasize);
    this.listenTo(this.model, 'circle_deemphasize', this.circle_deemphasize);
    return this;
    },

    remove: function() {
      if (this.circle_object) this.circle_object.remove();
      if (this.rect) this.rect.remove();
      Backbone.View.prototype.remove.call(this);
    },

    emphasize: function(options) {
      if (_.isUndefined(options)) options = {};
      if (_.isUndefined(options.emphasize_dot)) options.emphasize_dot = true;
      if (options && options.strong) {
        this.strongly_emphasized = true;
      }

      if (options.emphasize_dot) {
        this.circle_object.show();
        this.circle_object.emphasize();
      }
      if (this.rect) {
        this.rect.remove();
      }
      var f = this.image_canvas.imageCoordsToPaperCoords;
      var bx = f(this.model.get('bbox_x'));
      var by = f(this.model.get('bbox_y'));
      var bw = f(this.model.get('bbox_w'));
      var bh = f(this.model.get('bbox_h'));
      this.rect = this.image_canvas.getPaper().rect(bx, by, bw, bh);
      this.rect.attr({'stroke': this.color, 'stroke-width': 2});

      // TODO: draw an arrow
    },

    circle_emphasize: function(options) {
      if (_.isUndefined(options)) options = {};
      if (_.isUndefined(options.emphasize_dot)) options.emphasize_dot = true;
      if (options && options.strong) {
        this.strongly_emphasized = true;
      }

      if (options.emphasize_dot) {
        this.circle_object.show();
        this.circle_object.emphasize();
        
        // trigger hover for all tripleViews and regionViews associated with this entity
        if (this.model instanceof Entity){
          var triples_to_show;
          for(i = 0; i < Object.keys(ET_map).length; i++) {
   			if (ET_map[i].cid == this.model.cid){
   				triples_to_show = ET_map[i];
   			}
		  }
          for (i = 0; i < TV_array.length; i++) {
            for (j = 0; j < triples_to_show.length ; j++){
              if (TV_array[i].cid == triples_to_show[j].vid){
                  TV_array[i].trigger_hover();
              }
            }
          }
          /*
          var regions_to_show;
          for(i = 0; i < Object.keys(ER_map).length; i++) {
   			    if (ER_map[i].cid == this.model.cid){
   				   regions_to_show = ER_map[i];
   			    }
		      }
          for (i = 0; i < RV_array.length; i++) {
            for (j = 0; j < regions_to_show.length ; j++){
              if (RV_array[i].cid == regions_to_show[j].vid){
                  RV_array[i].trigger_hover();
              }
            }
          }
          */
        }
        
      }
      if (this.rect) {
        this.rect.remove();
      }
      var f = this.image_canvas.imageCoordsToPaperCoords;
      var bx = f(this.model.get('bbox_x'));
      var by = f(this.model.get('bbox_y'));
      var bw = f(this.model.get('bbox_w'));
      var bh = f(this.model.get('bbox_h'));
      this.rect = this.image_canvas.getPaper().rect(bx, by, bw, bh);
      this.rect.attr({'stroke': this.color, 'stroke-width': 2});

      // TODO: draw an arrow
    },

    deemphasize: function(options) {
      var strong = (options && options.strong);
      if (!strong && this.strongly_emphasized) {
        return;
      }
      if (strong && this.strongly_emphasized) {
        this.strongly_emphasized = false;
      }

      this.circle_object.deemphasize();
      
      
      if (this.model instanceof Region){
        this.circle_object.hide();
      }
      if (this.rect) {
        this.rect.remove();
        delete this.rect;
      }
    },

    circle_deemphasize: function(options) {
      var strong = (options && options.strong);
      if (!strong && this.strongly_emphasized) {
        return;
      }
      if (strong && this.strongly_emphasized) {
        this.strongly_emphasized = false;
      }

      this.circle_object.deemphasize();

      // trigger remove_hover for all tripleViews and regionViews associated with the entity
      if (this.model instanceof Entity){
        var triples_to_hide;
        for(i = 0; i < Object.keys(ET_map).length; i++) {
          if (ET_map[i].cid == this.model.cid){
           	triples_to_hide = ET_map[i];
          }
        }
        for (i = 0; i < TV_array.length; i++) {
          for (j = 0; j < triples_to_hide.length ; j++){
            if (TV_array[i].cid == triples_to_hide[j].vid){
                TV_array[i].trigger_remove_hover();
            }
          }
        }

        /*
        var regions_to_hide;
        for(i = 0; i < Object.keys(ER_map).length; i++) {
   			  if (ER_map[i].cid == this.model.cid){
   				 regions_to_hide = ER_map[i];
   			  }
		    }
        for (i = 0; i < RV_array.length; i++) {
            for (j = 0; j < regions_to_hide.length ; j++){
              if (RV_array[i].cid == regions_to_hide[j].vid){
                  RV_array[i].trigger_remove_hover();
              }
            }
        }
        */
       }
      
      if (this.rect) {
        this.rect.remove();
        delete this.rect;
      }
    },

    remove: function() {
      if (this.circle_object) this.circle_object.remove();
      if (this.rect) this.rect.remove();
      Backbone.View.prototype.remove.call(this);
    },
  });


  var SvgElemView = Backbone.View.extend({
    initialize: function(options) {
      _.extend(this, _.pick(options, 'image_canvas', 'color'));
      this.render();
    },

    render: function() {
      var f = this.image_canvas.imageCoordsToPaperCoords;
      var paper = this.image_canvas.getPaper();

      var cx = Math.round(f(this.model.get_centroid_x()));
      var cy = Math.round(f(this.model.get_centroid_y()));

      this.circle_object = new VG.CircleObject(paper, cx, cy, this.color,
                                               this.model.get('name'));
      this.circle_object.setExtent(0);
      this.circle_object.setCallbacks({
        hover_in: _.bind(this.model.trigger, this.model, 'emphasize'),
        hover_out: _.bind(this.model.trigger, this.model, 'deemphasize'),
        click: _.bind(this.trigger, this, 'dot-clicked'),
      });
      
      this.listenTo(this.model, 'emphasize', this.emphasize);
      this.listenTo(this.model, 'deemphasize', this.deemphasize);

      return this;
    },

    remove: function() {
      if (this.circle_object) this.circle_object.remove();
      if (this.rect) this.rect.remove();
      Backbone.View.prototype.remove.call(this);
    },

    emphasize: function(options) {
      if (_.isUndefined(options)) options = {};
      if (_.isUndefined(options.emphasize_dot)) options.emphasize_dot = true;
      if (options && options.strong) {
        this.strongly_emphasized = true;
      }

      if (options.emphasize_dot) {
        this.circle_object.emphasize();
      }
      if (this.rect) {
        this.rect.remove();
      }
      var f = this.image_canvas.imageCoordsToPaperCoords;
      var bx = f(this.model.get('bbox_x'));
      var by = f(this.model.get('bbox_y'));
      var bw = f(this.model.get('bbox_w'));
      var bh = f(this.model.get('bbox_h'));
      this.rect = this.image_canvas.getPaper().rect(bx, by, bw, bh);
      this.rect.attr({'stroke': this.color, 'stroke-width': 2});

      // TODO: draw an arrow
    },

    deemphasize: function(options) {
      var strong = (options && options.strong);
      if (!strong && this.strongly_emphasized) {
        return;
      }
      if (strong && this.strongly_emphasized) {
        this.strongly_emphasized = false;
      }

      this.circle_object.deemphasize();
      if (this.rect) {
        this.rect.remove();
        delete this.rect;
      }
    },

    remove: function() {
      if (this.circle_object) this.circle_object.remove();
      if (this.rect) this.rect.remove();
      Backbone.View.prototype.remove.call(this);
    },
  });


  var ReadOnlyView = HideableView.extend({
    initialize: function(options) {
      var valid_options = ['entities', 'triples','image_url', 'ul', 'svg_div',
                           'scrollable', 'color_by_input', 'VGViz'];
      _.extend(this, _.pick(options, valid_options));

      this.triple_list_view = new TripleListView({
                                    el: this.ul,
                                    collection: this.triples,
                                    color_by_input: this.color_by_input,
                                    VGViz: this.VGViz,
                                  });


      this.svg_view = new CombinedSvgView({
                        el: this.svg_div,
                        collection: this.entities,
                        image_width: options.image_width,
                        image_opacity: 1.0,
                        image_url: this.image_url,
                      });

      if (this.scrollable) {
        this.listenToOnce(this.svg_view, 'got-height', function(h) {
          this.ul.css({
            'max-height': h,
            'overflow-y': 'auto',
          });
        });
      }
    }
  });

  var CombinedView = HideableView.extend({
    initialize: function(options) {
      var valid_options = ['entities', 'triples', 'regions', 'image_url', 'ul', 'svg_div','reg_ul',
                           'scrollable', 'color_by_input', 'VGViz','graph_VGViz'];
      _.extend(this, _.pick(options, valid_options));

      this.triple_list_view = new TripleListView({
                                    el: this.ul,
                                    collection: this.triples,
                                    color_by_input: this.color_by_input,
                                    VGViz: this.VGViz,
                                  });

      this.region_list_view = new RegionListView({
                                    el: this.reg_ul,
                                    collection: this.regions,
                                    color_by_input: this.color_by_input,
                                    VGViz: this.graph_VGViz,
                                  });
      this.regions.add(this.entities.models); // passing two collections as one to backbone (regions first)
      this.svg_view = new CombinedSvgView({
                        el: this.svg_div,
                        collection: this.regions,
                        image_width: options.image_width,
                        image_opacity: 1.0,
                        image_url: this.image_url,
                      });

      if (this.scrollable) {
        this.listenToOnce(this.svg_view, 'got-height', function(h) {
          this.ul.css({
            'max-height': h,
            'overflow-y': 'auto',
          });
          this.reg_ul.css({
            'max-height': h,
            'overflow-y': 'auto',
          });
        });
      }
    }
  });


  // Export stuff
  vg.OpenSentences = vg.OpenSentences || {};

  vg.OpenSentences.Backbone = {
    Entity: Entity,
    Entities: Entities,
    Region: Region,
    Regions: Regions,
    BinaryTriple: BinaryTriple,
    UnaryTriple: UnaryTriple,
    Triples: Triples,
    collectionsToJSON: collectionsToJSON,
    collectionsFromJSON: collectionsFromJSON,
    parseTriples: parseTriples,
    regionsFromJSON: regionsFromJSON,
    parseRegions: parseRegions,
    TripleListView: TripleListView,
    TripleListElemView: TripleListElemView,
    RegionListView: RegionListView,
    RegionListElemView: RegionListElemView,
    SvgView: SvgView,
    CombinedSvgView: CombinedSvgView,
    CombinedSvgElemView: CombinedSvgElemView,
    SvgElemView: SvgElemView,
    HideableView: HideableView,
    ReadOnlyView: ReadOnlyView,
    CombinedView: CombinedView,
    UNARY_PREDICATES: UNARY_PREDICATES,
  };
  return vg;

})(VG || {});
