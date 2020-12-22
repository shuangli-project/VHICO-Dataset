var VG = (function(vg, $) {

  var MAX_RESULTS = 15;

  function parseRawSynsets(synsets_raw) {
    var synsets = {};
    for (var i = 0; i < synsets_raw.length; i++) {
      var synset = {
                     'wnid': synsets_raw[i].pk,
                     'words': synsets_raw[i].fields.words.split(','),
                     'children': synsets_raw[i].fields.children,
                     'gloss': synsets_raw[i].fields.gloss
                   };

      // Trim the whitespace from all words
      for (var j = 0; j < synset.words.length; j++) {
        synset.words[j] = $.trim(synset.words[j]);
      }

      synsets[synset.wnid] = synset;
    }

    return synsets;
  }

  /**
   * Creates a Synset-picker UI element inside a specified div using a dump of
   * raw synset information from the database.
   *
   * synset_search_url: A url which can be used to search for synsets based on
   *                    a user-input term. This url should accept GET requests
   *                    with a 'term' parameter and emit JSON of the following
   *                    form:
   *                    [
   *                      {wnid: wnid, word: word, gloss: gloss},
   *                      ...
   *                    ]
   *
   * div: The div in which the SynsetPicker will be created.
   *
   * A created SynsetPicker has the following methods:
   *
   * getWnid(): Get the wordnet-id of the currently selected synset.
   * getName(): Get the name of the currently selected synset.
   * addSynset(wnid, word): Add this synset to the list.
   * disable(): Disable the SynsetPicker
   * enable(): Enable the SynsetPicker
   *
   * Note that the SynsetPicker expects CSS rules for the following selectors:
   *
   * .synset-list
   * .synset-list li
   * .synset-list li:hover
   * .synset-list li.selected
   *
   * The SynsetPicker depends on jQuery and jQuery-UI.
   *
   * Usage:
   *
   * picker = new SynsetPicker($('#my_div'));
   * var current_wnid = picker.getWnid();
   * var current_name = picker.getName();
   */
  vg.SynsetPicker = function(synset_search_url, div) {
    var that = (this === vg ? {} : this);

    var synset_ul = $('<ul>').appendTo(div).addClass('synset-list');
    var wnid_to_li = {};
    var wnid_to_name = {};

    var current_wnid = null;

    var disabled = false;
    
    function deselectSynsets() {
      $('.synset-list li').removeClass('selected');
      current_wnid = null;
    }

    function selectSynset(wnid) {
      $('.synset-list li').removeClass('selected');
      wnid_to_li[wnid].addClass('selected');
      current_wnid = wnid;
    }

    /**
     * Add a synset to the UI for this SynsetPicker.
     * If the given synset is already in the list then this call does nothing.
     */
    function addSynset(wnid, word, gloss) {
      if (wnid_to_li.hasOwnProperty(wnid)) return;


      // If the gloss is undefined then ask the server for it and try again
      if (typeof(gloss) === 'undefined') {
        $.get(synset_search_url,
              {wnid: wnid},
              function(s) {
                addSynset(wnid, word, s.gloss);
              });
        return;
      }

      var text = word + ': ' + gloss;
      var li = $('<li>').text(text).appendTo(synset_ul);
      li.click(function() {
        if (disabled) return;
        var selected = li.hasClass('selected');
        deselectSynsets();
        if (!selected) selectSynset(wnid);
      })
      wnid_to_li[wnid] = li;
      wnid_to_name[wnid] = word;
    }

    var source = function(request, response) {
      var term = request.term;
      window.console.log(term);
      var data = $.get(
          synset_search_url,
          {term: term},
          function(data) {
            data = data.slice(0, MAX_RESULTS);
            for (var i = 0; i < data.length; i++) {
              var word = data[i].word;
              var gloss = data[i].gloss;
              var wnid = data[i].wnid;
              data[i].label = word + ": " + gloss;
              data[i].value = wnid;
            }
            response(data);
          });
    }

    var input = $('<input>');
    input.uniqueId();
    $('<label>').text('Enter an object name:')
                .attr('for', input.attr('id'))
                .appendTo(div);
    input.appendTo(div);
    input.autocomplete({
      source: source,
      position: { my: "left bottom", at: "left top", collision: "none" },
      select: function(e, ui) {
        var label = ui.item.label;
        var wnid = ui.item.value;
        var word = ui.item.word;
        var gloss = ui.item.gloss;
        input.val('');
        addSynset(wnid, word, gloss);
        selectSynset(wnid);
        e.preventDefault();

      },
      focus: function(e, ui) {
        var word = ui.item.word;
        input.val(word);
        e.preventDefault();
      }
    });

    that.disable = function() {
      disabled = true;
      input.autocomplete({disabled: true});
      input.prop('disabled', true);
    }

    that.enable = function() {
      disabled = false;
      input.autocomplete({disabled: false});
      input.prop('disabled', false);
    }

    that.getWnid = function() {
      return current_wnid;
    }

    that.getName = function() {
      if (current_wnid === null) return null;
      return wnid_to_name[current_wnid];
    }

    that.addSynset = addSynset;

    that.focus = function() { input.focus(); }
    
    return that;
  }

  return vg;

}(VG || {}, jQuery));
