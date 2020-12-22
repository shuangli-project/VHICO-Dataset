var VG = (function(vg) {

  var UNARY_PREDICATES = ['is', 'are', 'is a', 'made of', 'is made of'];

  // Clean a user-supplied string by trimming whitespace, making it
  // lowercase, and replacing all internal whitespace with a single
  // space.
  function clean_string(p) {
    return p.trim().toLowerCase().split(/\s+/).join(' ');
  }

  function Entity() {
    this.names = [];
    this.bounding_box = null;
    this.centroid_x = null;
    this.centroid_y = null;
  }

  Entity.prototype.get_centroid = function() {
    if (this.centroid_x !== null && this.centroid_y !== null) {
      return {'x': this.centroid_x, 'y': this.centroid_y};
    }
    if (this.bounding_box === null) {
      return null;
    }
    cx = this.bounding_box.x + this.bounding_box.w / 2;
    cy = this.bounding_box.y + this.bounding_box.h / 2;
    return {'x': cx, 'y': cy};
  }

  Entity.prototype.add_name = function(name) {
    if ($.inArray(name, this.names) === -1) {
      this.names.push(name);
    }
  }

  function Triple(s, p, o) {
    this.subject = s;
    this.predicate = p;
    this.object = o;

    this.subject_text = s;
    this.object_text = o;
  }

  function Model() {
    this.entities = {};
    this.binary_triples = {};
    this.unary_triples = {};

    this.next_entity_key = 0;
    this.next_sentence_key = 0;

    // List of sentece keys, in the order that they were added
    this.sentence_keys = [];
  }

  Model.from_data = function(data) {
    console.log(data);
    var model = new Model();
    var idx_to_e_key = [];
    for (var i = 0; i < data.objects.length; i++) {
      var e = new Entity();
      e.names = $.extend([], data.objects[i].names);
      if (data.objects[i].bbox) {
        e.bounding_box = $.extend({}, data.objects[i].bbox);
      }
      if (data.objects[i].x && data.objects[i].y) {
        e.centroid_x = data.objects[i].x;
        e.centroid_y = data.objects[i].y;
      }
      idx_to_e_key.push(model.add_entity(e));
    }
    for (var i = 0; i < data.binary_triples.length; i++) {
      var t = data.binary_triples[i];
      var s_key = idx_to_e_key[t.subject];
      var o_key = idx_to_e_key[t.object];
      if (t.text) {
        var spo = $.extend([], t.text);
      } else {
        var s = data.objects[t.subject].names[0];
        var p = t.predicate;
        var o = data.objects[t.object].names[0];
        var spo = [s, p, o];
      }
      model.add_binary_triple(spo, s_key, o_key);
    }
    for (var i = 0; i < data.unary_triples.length; i++) {
      var t = data.unary_triples[i];
      var s_key = idx_to_e_key[t.subject];
      if (t.text) {
        var spo = $.extend([], t.text);
      } else {
        var s = data.objects[t.subject].names[0];
        var p = t.predicate;
        var o = t.object;
        var spo = [s, p, o];
      }
      model.add_unary_triple(spo, s_key);
    }
    return model;
  }

  Model.prototype.add_entity = function(e) {
    this.entities[this.next_entity_key] = e;
    e.key = this.next_entity_key;
    return this.next_entity_key++;
  }

  Model.prototype.get_entity_keys = function() {
    var keys = [];
    for (var k in this.entities) if (this.entities.hasOwnProperty(k)) {
      keys.push(k);
    }
    return keys;
  }

  Model.prototype.is_unary_predicate = function(p) {
    p = clean_string(p);
    return $.inArray(p, UNARY_PREDICATES) !== -1;
  }

  Model.prototype.remove_unused_objects = function() {
    var live_objects = {};
    for (var k in this.binary_triples) {
      if (this.binary_triples.hasOwnProperty(k)) {
        var s = this.binary_triples[k].subject;
        var o = this.binary_triples[k].object;
        live_objects[s.key] = true;
        live_objects[o.key] = true;
      }
    }
    for (var k in this.unary_triples) {
      if (this.unary_triples.hasOwnProperty(k)) {
        var s = this.unary_triples[k].subject;
        live_objects[s.key] = true;
      }
    }
    var to_remove = [];
    for (var e_key in this.entities) {
      if (this.entities.hasOwnProperty(e_key)) {
        if (!live_objects.hasOwnProperty(e_key)) {
          to_remove.push(e_key);
        }
      }
    }
    for (var i = 0; i < to_remove.length; i++) {
      delete this.entities[to_remove[i]];
    }
  }

  // s_key and o_key should be the object keys, p should be the predicate string
  Model.prototype.add_binary_triple = function(spo, s_key, o_key) {
    if (!this.entities.hasOwnProperty(s_key) ||
        !this.entities.hasOwnProperty(o_key)) {
      return null;
    }
    s = this.entities[s_key];
    o = this.entities[o_key];
    s.add_name(spo[0]);
    o.add_name(spo[2]);
    var t = new Triple(s, spo[1], o);
    t.key = this.next_sentence_key;
    t.subject_text = spo[0];
    t.object_text = spo[2];
    this.binary_triples[this.next_sentence_key] = t;
    this.sentence_keys.push(this.next_sentence_key);
    return this.next_sentence_key++;
  }

  Model.prototype.add_unary_triple = function(spo, s_key) {
    if (!this.entities.hasOwnProperty(s_key)) return null;
    s = this.entities[s_key];
    var t = new Triple(s, spo[1], spo[2]);
    t.key = this.next_sentence_key;
    s.add_name(spo[0]);
    t.subject_text = spo[0];
    this.unary_triples[this.next_sentence_key] = t;
    this.sentence_keys.push(this.next_sentence_key);
    return this.next_sentence_key++;
  }

  Model.prototype.get_sentence = function(k) {
    if (this.binary_triples.hasOwnProperty(k)) {
      var t = this.binary_triples[k];
      return {
        'triple': [t.subject_text, t.predicate, t.object_text],
        'keys': [t.subject.key, t.object.key],
      }
    } else if (this.unary_triples.hasOwnProperty(k)) {
      var t = this.unary_triples[k];
      return {
        'triple': [t.subject_text, t.predicate, t.object],
        'keys': [t.subject.key],
      }
    }
    return null;
  }

  function count_keys(o) {
    var c = 0;
    for (var k in o) if (o.hasOwnProperty(k)) c++;
    return c;
  }

  Model.prototype.num_binary_triples = function() {
    return count_keys(this.binary_triples);
  }

  Model.prototype.num_unary_triples = function() {
    return count_keys(this.unary_triples);
  }

  Model.prototype.remove_sentence = function(k) {
    var idx = $.inArray(k, this.sentence_keys);
    if (idx !== -1) {
      console.log('deleting from sentence keys');
      this.sentence_keys.splice(idx, 1);
    }
    if (this.binary_triples.hasOwnProperty(k)) {
      console.log('deleting from binary');
      delete this.binary_triples[k];
    } else if (this.unary_triples.hasOwnProperty(k)) {
      console.log('deleting from unary');
      delete this.unary_triples[k];
    }
    this.remove_unused_objects();
  }

  Model.prototype.get_objects_by_name = function(name) {
    var e_keys = [];
    for (var e_key in this.entities) {
      if (this.entities.hasOwnProperty(e_key)) {
        var e = this.entities[e_key];
        if ($.inArray(name, e.names) !== -1) {
          e_keys.push(e_key);
        }
      }
    }
    return e_keys;
  }

  Model.prototype.get_data = function() {
    var data = {'objects': [], 'binary_triples': [], 'unary_triples': []};
    var e_key_to_idx = {};
    var next_idx = 0;
    for (var e_key in this.entities) if (this.entities.hasOwnProperty(e_key)) {
      var e = this.entities[e_key];
      data.objects.push({
        'names': $.extend([], e.names),
        'bbox': {'x': Math.round(e.bounding_box.x),
                 'y': Math.round(e.bounding_box.y),
                 'w': Math.round(e.bounding_box.w),
                 'h': Math.round(e.bounding_box.h)},
      });
      e_key_to_idx[e_key] = next_idx;
      next_idx++;
    }
    for (var t_key in this.binary_triples) {
      if (this.binary_triples.hasOwnProperty(t_key)) {
        var t = this.binary_triples[t_key];
        data.binary_triples.push({
          'subject': e_key_to_idx[t.subject.key],
          'predicate': t.predicate,
          'object': e_key_to_idx[t.object.key],
          'text': [t.subject_text, t.predicate, t.object_text],
        });
      }
    }
    for (var t_key in this.unary_triples) {
      if (this.unary_triples.hasOwnProperty(t_key)) {
        var t = this.unary_triples[t_key];
        data.unary_triples.push({
          'subject': e_key_to_idx[t.subject.key],
          'predicate': t.predicate,
          'object': t.object,
          'text': [t.subject_text, t.predicate, t.object_text],
        });
      }
    }
    return data;
  }

 function ReadOnlyView(model, image_url, div, sentence_list, options) {
    var DEFAULT_OPTIONS = {
      dot_radius_small: 6,
      dot_radius_big: 10,
      image_opacity: 0.8,
    };

    this.options = vg.merge_options(options, DEFAULT_OPTIONS);

    this.model = model;
    this.sentence_list = sentence_list;
    this.circle_objects = {};
    this.color_map = new VG.ColorMap();
    this.image_loaded = false;
    var that = this;
    this.image_canvas = new VG.ImageCanvas(div, image_url, div.width(), null,
                                           function() { that.update(); },
                                           options);
  }

  ReadOnlyView.prototype._emphasize_entity = function(e_key) {
    if (this.circle_objects.hasOwnProperty(e_key)) {
      var co = this.circle_objects[e_key];
      var e = this.model.entities[e_key];
      co.emphasize();
      if (co.rect) co.rect.remove();
      if (e.bounding_box) {
        var f = this.image_canvas.imageCoordsToPaperCoords;
        co.rect =
          this.image_canvas.getPaper().rect(
              f(e.bounding_box.x), f(e.bounding_box.y),
              f(e.bounding_box.w), f(e.bounding_box.h));
        co.rect.attr({'stroke': co.getColor(), 'stroke-width': 2});
      }
    }
  }

  ReadOnlyView.prototype._deemphasize_entity = function(e_key) {
    if (this.circle_objects.hasOwnProperty(e_key)) {
      var co = this.circle_objects[e_key];
      co.deemphasize();
      if (co.rect) {
        co.rect.remove();
        delete co.rect;
      }
    }
  }

  ReadOnlyView.prototype._emphasize_triple = function(that, s) {
    that._emphasize_entity(s.keys[0]);
    if (s.keys.length > 1) {
       that._emphasize_entity(s.keys[1]);
       var x1 = that.circle_objects[s.keys[0]].getX();
       var y1 = that.circle_objects[s.keys[0]].getY();
       var x2 = that.circle_objects[s.keys[1]].getX();
       var y2 = that.circle_objects[s.keys[1]].getY();
       var paper = that.image_canvas.getPaper();
       var arrow = new VG.Arrow(paper, x1, y1, x2, y2);
       arrow.emphasize();
       return arrow;
    }
    return null;
  }

  ReadOnlyView.prototype._deemphasize_triple = function(that, s, arrow) {
    that._deemphasize_entity(s.keys[0]);
    if (s.keys.length > 1) {
      that._deemphasize_entity(s.keys[1]);
      if (arrow) {
        arrow.remove();
        arrow = null;
      }
    }
  }

  ReadOnlyView.prototype.update = function() {
    // First delete circle objects that aren't in the model
    var to_remove = [];
    for (e_key in this.circle_objects) {
      if (this.circle_objects.hasOwnProperty(e_key)) {
        if (!this.model.entities.hasOwnProperty(e_key)) {
          to_remove.push(e_key);
        }
      }
    }
    for (var i = 0; i < to_remove.length; i++) {
      if (this.circle_objects[e_key].rect) {
        this.circle_objects[e_key].rect.remove();
      }
      this.circle_objects[e_key].remove();
      delete this.circle_objects[e_key];
    }

    // Now draw any new entities from the model
    var that = this;
    for (var e_key in this.model.entities) {
      if (this.model.entities.hasOwnProperty(e_key)
          && !this.circle_objects.hasOwnProperty(e_key)) {
        (function() {
          var paper = that.image_canvas.getPaper();
          var f = that.image_canvas.imageCoordsToPaperCoords;
          var e = that.model.entities[e_key];
          var c = e.get_centroid();
          var name = e.names[0];
          var color = that.color_map.getColor(name);

          // Here we are relying on the fact that CircleObject takes the
          // same circle_radius_big and circle_radius_small options as
          // a ReadOnlyView.
          console.log(c);
          console.log(e);
          var co = new VG.CircleObject(paper, f(c.x), f(c.y), color, name,
                                       this.options);
          co.setExtent(0);
          that.circle_objects[e_key] = co;

          var e_key_local = e_key;
          if (that.options != undefined && that.options['show_all_triples']) {
            that._emphasize_entity(e_key_local);
          } else {
            co.setCallbacks({
              'hover_in': function() { that._emphasize_entity(e_key_local); },
              'hover_out': function() { that._deemphasize_entity(e_key_local); },
            });
          }
        })();
      }
    }

    // Now draw the list elements
    var lis = [];
    this.sentence_list.empty();
    for (var i = 0; i < this.model.sentence_keys.length; i++) {
      (function() {
        var s = that.model.get_sentence(that.model.sentence_keys[i]);
        var li = $('<li>').text(s.triple.join(' '))
                          .addClass('list-group-item')
                          .appendTo(that.sentence_list);
        var arrow = null;
        if (that.options != undefined && that.options['show_all_triples']) {
          arrow = that._emphasize_triple(that, s);
        }
        li.hover(
          function() {
            arrow = that._emphasize_triple(that, s);
          },
          function() {
            that._deemphasize_triple(that, s, arrow);
          });
      })();
    }
  }

  vg.OpenSentences = vg.OpenSentences || {};

  _.extend(vg.OpenSentences, {
    clean_string: clean_string,
    Entity: Entity,
    Triple: Triple,
    Model: Model,
    ReadOnlyView: ReadOnlyView,
  });

  return vg;

}(VG || {}));
