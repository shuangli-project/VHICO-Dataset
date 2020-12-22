/* Filter out all elements greater than `max` in `array` and return new array.
 * Used to cap out data for histograms below so that we don't show all the random outliers.
 */
function cap(array, max) {
  return array.filter(function(elem) {
    return elem <= max;
  });
}

function formatNumber(number) {
  number = number.toFixed(2).replace(/\.0+$/, '');
  return commafy(number);

  // Source: https://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
  function commafy( num){
    var parts = (''+(num<0?-num:num)).split("."), s=parts[0], i=L= s.length, o='',c;
    while(i--){ o = (i==0?'':((L-i)%3?'':',')) 
                    +s.charAt(i) +o }
    return (num<0?'-':'') + o + (parts[1] ? '.' + parts[1] : ''); 
  }
}

function draw_histogram(config) {
    config = $.extend({
      bindto: '#chart',
      maxBins: false,
      xLabel: '',
      yLabel: 'Percent of Data',
      color: '',
      barWidthRatio: 0.95
    }, config);

    /* First, bin the values for c3 */

    var margin = {top: 10, right: 30, bottom: 30, left: 30},
        width = 960 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;


    // Edge case to make sure the x-axis goes from 0 to 1,
    // and not 0 to 2, for small domains.
    var max = d3.max(config.values);
    var domainMax = max <= 1 ? max : max + 1;

    var x = d3.scale.linear()
        .domain([0, domainMax])
        .range([0, width]);

    // Twenty uniformly-spaced bins or one bin for each value in data.
    var ticks = x.ticks(config.maxBins ? d3.max(config.values) : 20);

    var data = d3.layout.histogram()
        .bins(ticks)
        (config.values);

    // I don't know d3 too well, so there's probably a better way to do this.
    // Anyways, the ticks are meant to be around the bars (i.e., a range),
    // but we want the number of elements that have a specific value.
    // The last tick in this array is not used because of this one-off
    // issue, so remove it.
    ticks.splice(ticks.length - 1, 0);

    var total = data.reduce(function(previousValue, curr) {
      return previousValue + curr.length;
    }, 0);

    // Data was just a binned array with elements in their corresponding
    // bins, but we want the percent of all elements in each bin.
    data = data.map(function(elem) {
        return elem.length / total * 100;
    });

    var chart = c3.generate({
      bindto: config.bindto,
      data: {
        x: 'x',
          columns: [
              ['Data'].concat(data),
              ['x'].concat(ticks)
          ],
          type: 'bar',
          colors: {
            Data: config.color
          }
      },
      axis: {
        x: {
          label: {
            text: config.xLabel,
            position: 'outer-middle'
          }
        },
        y: {
          label: {
            text: config.yLabel,
            position: 'outer-middle'
          }
        }
      },
      bar: {
          width: {
              ratio: config.barWidthRatio
          }
      },
      legend: {
        show: false
      }
    });
}


function draw_labeled_histogram(config) {
  config = $.extend({
    bindto: '#chart',
    dataName: 'Num occurrences',
    horizontal: true,
    color: '',
  }, config);

  // We don't directly pass this object to `c3.generate` because we need to set
  // a key for the chart's color based on the config passed in by the client.
  var chartOptions = {
    bindto: config.bindto,
    size: {
        height: config.height
    },
    data: {
        x: 'x',
        columns: [
            ['x'].concat(config.labels),
            [config.dataName].concat(config.data)
        ],
        type: 'bar',
        colors: {

        }

    },
    bar: {
        width: {
            ratio: 0.6 // this makes bar width 60% of length between ticks
        }
    },
    axis: {
        x: {
            type: 'category',
            tick: {
                multiline: !config.horizontal  // No multiline labels on horizontal bar charts
            }
        },
        y: {
          label: {
            text: config.dataName,
            position: 'outer'
          }
        },
        rotated: config.horizontal
    },
    legend: {
        hide: true
    }
  };

  chartOptions.data.colors[config.dataName] = config.color;

  var chart = c3.generate(chartOptions);
}
