import React from 'react';
import PropTypes from 'prop-types';
import { PivotData } from './Utilities';
import { concat, debounce } from 'lodash';
import raf from 'rc-util/lib/raf';
import $ from 'jquery';

// helper function for setting row/col-span in pivotTableRenderer
const spanSize = function (arr, i, j) {
  let x;
  if (i !== 0) {
    let asc, end;
    let noDraw = true;
    for (
      x = 0, end = j, asc = end >= 0;
      asc ? x <= end : x >= end;
      asc ? x++ : x--
    ) {
      if (arr[i - 1][x] !== arr[i][x]) {
        noDraw = false;
      }
    }
    if (noDraw) {
      return -1;
    }
  }
  let len = 0;
  while (i + len < arr.length) {
    let asc1, end1;
    let stop = false;
    for (
      x = 0, end1 = j, asc1 = end1 >= 0;
      asc1 ? x <= end1 : x >= end1;
      asc1 ? x++ : x--
    ) {
      if (arr[i][x] !== arr[i + len][x]) {
        stop = true;
      }
    }
    if (stop) {
      break;
    }
    len++;
  }
  return len;
};

function redColorScaleGenerator(values) {
  const min = Math.min.apply(Math, values);
  const max = Math.max.apply(Math, values);
  return x => {
    // eslint-disable-next-line no-magic-numbers
    const nonRed = 255 - Math.round((255 * (x - min)) / (max - min));
    return { backgroundColor: `rgb(255,${nonRed},${nonRed})` };
  };
}

let ticking = false
let duration = 450

function makeRenderer(opts = {}) {
  class TableRenderer extends React.PureComponent {
    handleScriptLoad() {
      $(document).ready(function () {
        $('.pivotTable').dataTable({ scrollY: '50vh', scrollCollapse: true, paging: false });
      });
    }

    onScroll() {
      let self = this
      const startTime = Date.now();
      function asyncTableScroll() {
        const timestamp = Date.now();
        const time = timestamp - startTime;
        console.log(time, 'time');
        var scrollLeft = $(self).prop('scrollLeft');
        $('.pivot-table-header').prop('scrollLeft', scrollLeft);
        ticking = false;
      }
      if (!ticking) {
        raf(asyncTableScroll);
        ticking = true;
      }

    }
    componentDidMount() {
      // 同步两边的滚动
      $('.pivot-table-body').on('scroll', this.onScroll);
    }
    componentWillUnmount() {
      $('.pivot-table-body').off('scroll')
    }
    render() {
      const pivotData = new PivotData(this.props);
      const colAttrs = pivotData.props.cols.length ? concat(pivotData.props.cols, undefined) : [undefined, undefined];
      const rowAttrs = pivotData.props.rows;
      const rowKeys = pivotData.getRowKeys();
      const colKeys = pivotData.getColKeys();
      const aggregatorGather = this.props.aggregatorGather;
      // const grandTotalAggregator = pivotData.getAggregator([], []);

      let valueCellColors = () => { };
      let rowTotalColors = () => { };
      let colTotalColors = () => { };
      // todo
      if (opts.heatmapMode) {
        const colorScaleGenerator = this.props.tableColorScaleGenerator;
        // const rowTotalValues = colKeys.map(x =>
        //   pivotData.getAggregator([], x).value()
        // );
        // rowTotalColors = colorScaleGenerator(rowTotalValues);
        // const colTotalValues = rowKeys.map(x =>
        //   pivotData.getAggregator(x, []).value()
        // );
        // colTotalColors = colorScaleGenerator(colTotalValues);
        if (opts.heatmapMode === 'full') {
          const allValues = [];
          rowKeys.map(r =>
            colKeys.map(c =>
              allValues.push(pivotData.getAggregator(r, c).value())
            )
          );
          const colorScale = colorScaleGenerator(allValues);
          valueCellColors = (r, c, v) => colorScale(v);
        } else if (opts.heatmapMode === 'row') {
          const rowColorScales = {};
          rowKeys.map(r => {
            const rowValues = colKeys.map(x =>
              pivotData.getAggregator(r, x).value()
            );
            rowColorScales[r] = colorScaleGenerator(rowValues);
          });
          valueCellColors = (r, c, v) => rowColorScales[r](v);
        } else if (opts.heatmapMode === 'col') {
          const colColorScales = {};
          colKeys.map(c => {
            const colValues = rowKeys.map(x =>
              pivotData.getAggregator(x, c).value()
            );
            colColorScales[c] = colorScaleGenerator(colValues);
          });
          valueCellColors = (r, c, v) => colColorScales[c](v);
        }
      }

      const getClickHandler =
        this.props.tableOptions && this.props.tableOptions.clickCallback
          ? (value, rowValues, colValues) => {
            const filters = {};
            for (const i of Object.keys(colAttrs || {})) {
              const attr = colAttrs[i];
              if (colValues[i] !== null) {
                filters[attr] = colValues[i];
              }
            }
            for (const i of Object.keys(rowAttrs || {})) {
              const attr = rowAttrs[i];
              if (rowValues[i] !== null) {
                filters[attr] = rowValues[i];
              }
            }
            return e =>
              this.props.tableOptions.clickCallback(
                e,
                value,
                filters,
                pivotData
              );
          }
          : null;

      return (
        <div className="pivot-table-warp">
          <div className="pivot-table-container">
            <div className="pivot-table-header">
              <table className="pivotTable">
                <colgroup>
                  {
                    rowAttrs.length === 0 && colKeys.length === 0 && (
                      <col style={{ width: '120px' }} />
                    )
                  }

                  {(rowAttrs.length !== 0 && (
                    rowAttrs.map(function (r, i) {
                      return (
                        <col style={{ width: '120px' }} />
                      );
                    })
                  ))}
                  {colKeys.length && (
                    <col style={{ width: '120px' }} />
                  ) || null}
                  {colKeys.map(function (colKey, i) {
                    return (
                      <col style={{ width: '120px' }} />
                    );
                  })}
                  {(
                    aggregatorGather.map(function (_, o) {
                      return (
                        <col style={{ width: '120px' }} />
                      )
                    })
                  ) || <React.Fragment />}
                </colgroup>
                <thead>
                  {colAttrs.map(function (c, j) {
                    return (
                      <tr key={`${c}${j}`}>

                        {
                          rowAttrs.length === 0 && colKeys.length === 0 && (
                            <th colSpan={rowAttrs.length} rowSpan={colAttrs.length - 1} />
                          ) || null
                        }

                        {j === 0 && rowAttrs.length !== 0
                          && (
                            <th colSpan={rowAttrs.length} rowSpan={colAttrs.length - 1} style={{ position: 'sticky', zIndex: 2, left: 0 }} />
                          )
                          || (rowAttrs.length !== 0 && j === colAttrs.length - 1 && (
                            rowAttrs.map(function (r, i) {
                              return (
                                <th style={{ position: 'sticky', zIndex: 2, left: i * 120 + 'px' }} className="pivotAxisLabel" key={`rowAttr${i}`}>
                                  {r}
                                </th>
                              );
                            })
                          ))}

                        {colKeys.length && (
                          <th style={{ position: 'sticky', zIndex: 2, left: rowAttrs.length * 120 + 'px' }} className="pvtAxisLabel">{c}</th>
                        ) || null}

                        {colKeys.map(function (colKey, i) {
                          const x = spanSize(colKeys, i, j);
                          if (x === -1) {
                            return null;
                          }
                          return (
                            <th
                              className="pivotColLabel"
                              key={`colKey${i}${j}`}
                              colSpan={x}
                            >
                              {colKey[j]}
                            </th>
                          );
                        })}

                        {/* total */}
                        {(j === 0) && (
                          <th
                            className="pivotTotalLabel"
                            key={`pivotTotalLabel${j}`}
                            colSpan={aggregatorGather.length}
                            rowSpan={
                              colAttrs.length - (aggregatorGather.length === 0 ? 0 : 1)
                            }
                          >
                            Totals
                          </th>
                        ) || <React.Fragment />}

                        {/* total 细分维度 */}
                        {(j === colAttrs.length - 1) && (
                          aggregatorGather.map(function (_, o) {
                            return (
                              <th
                                key={`Total${j}${o}`}
                                className="pivotColLabel pivotRowTotal"
                              >
                                {`${_.vals.join(' ')}(${_.aggregatorName})`}
                              </th>)
                          })
                        ) || <React.Fragment />}

                      </tr>
                    );
                  })}

                </thead>
              </table>
            </div>
            <div className="pivot-table-body">
              <table className="pivotTable">
                <colgroup>
                  {rowAttrs.length
                    &&
                    rowAttrs.map(function (txt, j) {
                      return (
                        <col style={{ width: '120px' }} />
                      );
                    })
                    ||
                    <col style={{ width: '120px' }} />}
                  {/* todo */}
                  {rowAttrs.length !== 0 && colKeys.length !== 0
                    && (
                      <col style={{ width: '120px' }} />
                    )
                  }
                  {colKeys.map(function (colKey, j) {
                    return (
                      <col style={{ width: '120px' }} />
                    );
                  })}
                  {aggregatorGather.map(function (_, j) {
                    return (<col style={{ width: '120px' }} />)
                  })}
                </colgroup>
                <tbody>
                  {rowKeys.map(function (rowKey, i) {
                    return (
                      <tr key={`rowKeyRow${i}`}>
                        {rowKey.length
                          &&
                          rowKey.map(function (txt, j) {
                            const x = spanSize(rowKeys, i, j);
                            if (x === -1) {
                              return null;
                            }
                            return (
                              <th
                                key={`rowKeyLabel${i}-${j}`}
                                className="pivotRowLabel"
                                rowSpan={x}
                                colSpan={
                                  j === rowAttrs.length - 1 && colKeys.length !== 0
                                    ? 2
                                    : 1
                                }
                                style={{ position: 'sticky', zIndex: 2, left: (j) * 120 + 'px' }}
                              >
                                {txt}
                              </th>
                            );
                          })
                          ||
                          <th
                            key={`rowKeyLabel${i}`}
                            className="pivotRowLabel"
                          >
                            { }
                          </th>}
                        {colKeys.map(function (colKey, j) {
                          const aggregator = pivotData.getAggregator(rowKey, colKey);
                          return (
                            <td
                              className="pivotVal"
                              key={`pivotVal${i}-${j}`}
                              onClick={
                                getClickHandler &&
                                getClickHandler(aggregator.value(), rowKey, colKey)
                              }
                              style={valueCellColors(
                                rowKey,
                                colKey,
                                aggregator.value()
                              )}
                            >
                              {aggregator.format(aggregator.value())}
                            </td>
                          );
                        })}
                        {aggregatorGather.map(function (_, j) {
                          const totalAggregator = pivotData.getAggregator([...rowKey, _.aggregatorName], []);
                          return (<td
                            className="pivotTotal pivotRowTotal"
                            key={`pivotTotal${i}-${j}-${_.aggregatorName}`}
                            onClick={
                              getClickHandler &&
                              getClickHandler(totalAggregator.value(), rowKey, [null])
                            }
                            style={colTotalColors(totalAggregator.value())}
                          >
                            {totalAggregator.format(totalAggregator.value())}
                          </td>)
                        })}
                      </tr>
                    );
                  })}

                  <tr>
                    {
                      (
                        <th
                          className="pivotTotalLabel"
                          colSpan={rowAttrs.length + (colKeys.length === 0 ? 0 : 1)}
                          style={{ position: 'sticky', zIndex: 2, left: 0 }}
                        >
                          Totals
                        </th>
                      ) || <React.Fragment />
                    }

                    {colKeys.map(function (colKey, i) {
                      const totalAggregator = pivotData.getAggregator([], colKey);
                      return (
                        <td
                          className="pivotTotal"
                          key={`total${i}`}
                          onClick={
                            getClickHandler &&
                            getClickHandler(totalAggregator.value(), [null], colKey)
                          }
                          style={rowTotalColors(totalAggregator.value())}
                        >
                          {totalAggregator.format(totalAggregator.value())}
                        </td>
                      );
                    })}

                    {(
                      aggregatorGather.map(function (_, o) {
                        const grandTotalAggregator = pivotData.getAggregator([], [], _.aggregatorName);
                        return (
                          <td
                            key={`aggregatorGather${o}`}
                            onClick={
                              getClickHandler &&
                              getClickHandler(grandTotalAggregator.value(), [null], [null])
                            }
                            className="pivotGrandTotal pivotRowTotal"
                          >
                            {grandTotalAggregator.format(grandTotalAggregator.value())}
                          </td>)
                      })) || <React.Fragment />
                    }
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }
  }

  TableRenderer.defaultProps = PivotData.defaultProps;
  TableRenderer.propTypes = PivotData.propTypes;
  TableRenderer.defaultProps.tableColorScaleGenerator = redColorScaleGenerator;
  TableRenderer.defaultProps.tableOptions = {};
  TableRenderer.propTypes.tableColorScaleGenerator = PropTypes.func;
  TableRenderer.propTypes.tableOptions = PropTypes.object;
  return TableRenderer;
}

class TSVExportRenderer extends React.PureComponent {
  render() {
    const pivotData = new PivotData(this.props);
    const rowKeys = pivotData.getRowKeys();
    const colKeys = pivotData.getColKeys();
    if (rowKeys.length === 0) {
      rowKeys.push([]);
    }
    if (colKeys.length === 0) {
      colKeys.push([]);
    }

    const headerRow = pivotData.props.rows.map(r => r);
    if (colKeys.length === 1 && colKeys[0].length === 0) {
      headerRow.push(this.props.aggregatorName);
    } else {
      colKeys.map(c => headerRow.push(c.join('-')));
    }

    const result = rowKeys.map(r => {
      const row = r.map(x => x);
      colKeys.map(c => {
        const v = pivotData.getAggregator(r, c).value();
        row.push(v ? v : '');
      });
      return row;
    });

    result.unshift(headerRow);

    return (
      <textarea
        value={result.map(r => r.join('\t')).join('\n')}
        style={{ width: window.innerWidth / 2, height: window.innerHeight / 2 }}
        readOnly={true}
      />
    );
  }
}

TSVExportRenderer.defaultProps = PivotData.defaultProps;
TSVExportRenderer.propTypes = PivotData.propTypes;

export default {
  Table: makeRenderer(),
  'Table Heatmap': makeRenderer({ heatmapMode: 'full' }),
  'Table Col Heatmap': makeRenderer({ heatmapMode: 'col' }),
  'Table Row Heatmap': makeRenderer({ heatmapMode: 'row' }),
  'Exportable TSV': TSVExportRenderer,
};
