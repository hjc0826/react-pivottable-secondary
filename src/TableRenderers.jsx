import React from 'react';
import PropTypes from 'prop-types';
import { PivotData } from './Utilities';
import { concat } from 'lodash';

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

function makeRenderer(opts = {}) {
  class TableRenderer extends React.PureComponent {
    handleScriptLoad() {
      console.log($);
      $(document).ready(function () {
        $('.pvtTable').dataTable({ scrollY: '50vh', scrollCollapse: true, paging: false });
      });
    }
    render() {
      const pivotData = new PivotData(this.props);
      console.log(pivotData, 'pivotData');
      console.log(this.props, 'props');
      const colAttrs = pivotData.props.cols.length ? concat(pivotData.props.cols, undefined) : [undefined, undefined];
      const rowAttrs = pivotData.props.rows;
      const rowKeys = pivotData.getRowKeys();
      const colKeys = pivotData.getColKeys();
      const aggregatorGather = this.props.aggregatorGather;
      // const grandTotalAggregator = pivotData.getAggregator([], []);

      let valueCellColors = () => { };
      let rowTotalColors = () => { };
      let colTotalColors = () => { };
      if (opts.heatmapMode) {
        const colorScaleGenerator = this.props.tableColorScaleGenerator;
        const rowTotalValues = colKeys.map(x =>
          pivotData.getAggregator([], x).value()
        );
        rowTotalColors = colorScaleGenerator(rowTotalValues);
        const colTotalValues = rowKeys.map(x =>
          pivotData.getAggregator(x, []).value()
        );
        colTotalColors = colorScaleGenerator(colTotalValues);

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
        <table className="pvtTable">
          <thead>
            {rowAttrs.length !== 0 && (
              <tr>
                {rowAttrs.map(function (r, i) {
                  return (
                    <th className="pvtAxisLabel" colSpan="1" rowSpan={colAttrs.length + (rowAttrs.length === 0 ? 0 : 1)} key={`rowAttr${i}`}>
                      {r}
                    </th>
                  );
                })}
              </tr>
            )}

            {rowAttrs.length === 0 && colKeys.length !== 0 && (
              <tr>
                <th className="pvtTotalLabel" key="pvtTotalLabelTop" rowSpan={colAttrs.length + (aggregatorGather.length === 0 ? 0 : 1)}>
                  {colAttrs.length === 0 ? 'Totals' : null}
                </th>
              </tr>
            )}

            {colAttrs.map(function (c, j) {
              return (
                <tr key={`${c}${j}`}>
                  {colKeys.map(function (colKey, i) {
                    const x = spanSize(colKeys, i, j);
                    if (x === -1) {
                      return null;
                    }
                    return (
                      <th
                        className="pvtColLabel"
                        key={`colKey${i}${j}`}
                        colSpan={x}
                      >
                        {colKey[j]}
                      </th>
                    );
                  })}

                  {(j === 0 && rowKeys.length) && (
                    <th
                      className="pvtTotalLabel"
                      key={`pvtTotalLabel${j}`}
                      colSpan={aggregatorGather.length}
                      rowSpan={
                        colAttrs.length - (aggregatorGather.length === 0 ? 0 : 1)
                      }
                    >
                      Totals
                    </th>
                  ) || <React.Fragment />}

                  {(j === colAttrs.length - 1 && rowKeys.length) && (
                    aggregatorGather.map(function (_, o) {
                      return (
                        <th
                          key={`Total${j}${o}`}
                          className="pvtColLabel pvtRowTotal"
                        >
                          {`${_.vals.join(' ')}(${_.aggregatorName})`}
                        </th>)
                    })
                  ) || <React.Fragment />}

                </tr>
              );
            })}
          </thead>

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
                          className="pvtRowLabel"
                          rowSpan={x}
                        >
                          {txt}
                        </th>
                      );
                    })
                    ||
                    <th
                      key={`rowKeyLabel${i}`}
                      className="pvtRowLabel"
                    >
                      { }
                    </th>}
                  {colKeys.map(function (colKey, j) {
                    const aggregator = pivotData.getAggregator(rowKey, colKey);
                    return (
                      <td
                        className="pvtVal"
                        key={`pvtVal${i}-${j}`}
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
                      className="pvtTotal pvtRowTotal"
                      key={`pvtTotal${i}-${j}-${_.aggregatorName}`}
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
                colKeys.length && (
                  <th
                    className="pvtTotalLabel"
                    colSpan={rowAttrs.length}
                  >
                    Totals
                  </th>
                ) || <React.Fragment />
              }

              {colKeys.map(function (colKey, i) {
                const totalAggregator = pivotData.getAggregator([], colKey);
                return (
                  <td
                    className="pvtTotal"
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

              {(colKeys.length && rowKeys.length) && (
                aggregatorGather.map(function (_, o) {
                  const grandTotalAggregator = pivotData.getAggregator([], [], _.aggregatorName);
                  return (
                    <td
                      key={`aggregatorGather${o}`}
                      onClick={
                        getClickHandler &&
                        getClickHandler(grandTotalAggregator.value(), [null], [null])
                      }
                      className="pvtGrandTotal pvtRowTotal"
                    >
                      {grandTotalAggregator.format(grandTotalAggregator.value())}
                    </td>)
                })) || <React.Fragment />
              }
            </tr>
          </tbody>
        </table>
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
