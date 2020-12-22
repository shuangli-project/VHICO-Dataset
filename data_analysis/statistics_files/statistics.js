(function() {

// Fetch data sources (i.e., json file names) from different types of data representations.
var dataSources = $('[data-statistic],[data-histogram],[data-labeled-histogram]').map(function(index, elem) {
  return $(elem).attr('data-src');
});

var fetched = [];
for (var i = 0; i < dataSources.length; i++) {

  // If we've already fetched this file, don't fetch it again.
  if (fetched.indexOf(dataSources[i]) != -1) {
    continue;
  }

  fetched.push(dataSources[i]);

  // Closure necessary so we have access to dataSource in the callback.
  (function(dataSource) {
    $.getJSON('/static/data/statistics/' + dataSources[i] + '.json', function(data) {
      // Fill in all text data from this file.
      $('[data-statistic][data-src="' + dataSource + '"]').each(function(index, elem) {
        var $elem = $(elem);
        var val = data[$elem.data('key')];
        if (typeof(val) === "number") {
          val = formatNumber(val);
        }

        if ($elem.data('aslist') === undefined) {
          $elem.text(val);
        } else {
          $.each(val, function(i, elem) {
              $elem.append('<li>' + elem + '</li>');
          });
        }
      });

      // Draw histograms with data from this file, if it exists.
      $('[data-histogram][data-src="' + dataSource + '"]').each(function(index, elem) {
        var $elem = $(elem);
        var values;
        var key = $elem.data('key');

        // If no key, assume entire data json is an array for the histogram.
        if (key === undefined) {
          values = data;
        } else {
          values = data[key];
        }

        // Cap data if necessary.
        if ($elem.data('cap') !== undefined) {
          values = cap(values, $elem.data('cap'));
        }

        draw_histogram({
          bindto: elem,
          values: values,
          maxBins: $elem.data('maxbins') !== undefined,
          xLabel: $elem.data('xlabel'),
          color: $elem.data('color')
        });

        // Allow larger font sizes to show up.
        // Note that this is very hacky.
        if (PAPER_MODE) {
          $elem.find('defs').remove();
          $elem.find('svg').height(400);
        }

      });

      // Draw labeled histograms with data from this file, if it exists.
      $('[data-labeled-histogram][data-src="' + dataSource + '"]').each(function(index, elem) {
        var $elem = $(elem);
        var labels = data[$elem.data('labelskey')];
        var counts = data[$elem.data('countskey')];
        var height = $elem.data('height');

        // Make chart taller with bigger font size.
        if (PAPER_MODE) {
          height *= 1.5;
        }

        draw_labeled_histogram({
          bindto: elem,
          labels: labels,
          data: counts,
          height: height,
          color: $elem.data('color')
        });
      });
    });
  })(dataSources[i])
}

// One-off case for special histogram.
var chart = c3.generate({
  bindto: '#clusters-per-image-coco-compare',
  data: {
      // Num images in 0, 1, 2, 3, 4, 5, 6, and 7 clusters. Then get percentage relative to number of total images.
      columns: [
          ['Sample5'].concat([0, 55, 439, 1914, 3742, 2952, 0].map(function(e) { return e*100 / 9102; })),
          ['Coco'].concat([0, 10786, 33411, 44342, 27655, 7090, 3].map(function(e) { return e*100 / 123287; }))
      ],
      type: 'bar'
  },
  axis: {
    x: {
      label: {
        text: 'Number of clusters',
        position: 'outer-middle'
      }
    },
    y: {
      label: {
        text: '% of images',
        position: 'outer-middle'
      }
    }
  },
  bar: {
      width: {
          ratio: 0.5 // this makes bar width 50% of length between ticks
      }
  },
  tooltip: {
        format: {
            value: function(value) {
                return value.toFixed(2) + '%';  // fix percentage to 2 decimal points
            }
        }
    }
});
})();
