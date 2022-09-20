import React from 'react';
import PropTypes from 'prop-types';
import { PivotData } from './Utilities';
import { concat } from 'lodash';
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

function getScrollbarWidth() {
  const scrollDiv = document.createElement('div');
  scrollDiv.style.cssText = 'width: 99px; height: 99px; overflow: scroll; position: absolute; top: -9999px;';
  document.body.appendChild(scrollDiv);
  const scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
  document.body.removeChild(scrollDiv);

  return scrollbarWidth;
}

const DEFAULT_ROW_HEIGHT = 32; // 默认表格单行高度
const OFFSET_HORIZONTAL = 300; // 横向滚动前、后偏移量


function makeRenderer(opts = {}) {
  const POSITION_TABLE_BODY = 'tableBody'; // 表示纵向滚动响应位置在表格内容上
  class TableRenderer extends React.PureComponent {
    constructor(props) {
      super(props);
      this.getHorizontalDom = (dom) => {
        this.horizontalDom = dom || this.horizontalDom;
      };
      this.getVirtualTableRef = (dom) => {
        this.virtualTable = dom || this.virtualTable;
        this.setVirtualSize(dom);
      };
      this.valueCellColors = () => { };
      this.rowTotalColors = () => { };
      this.colTotalColors = () => { };
      this.getClickHandler = null;
      this.virtualTable = null;
      this.tableHeader = null;
      this.virtualTableWidth = 0; // 虚拟表格宽度
      this.scrollBarWidth = getScrollbarWidth(); // 滚动条宽度
      this.scrollDom = null; // 纵向假滚动条节点
      this.horizontalDom = null; // 横向滚动节点
      this.verticalDom = null; // 纵向滚动节点
      this.mousePosition = ''; // 鼠标所在位置，用于区别纵向滚动由哪个节点相应的
      this.state = {
        totalHeight: 0, // 表格内容区域总高度
        totalWidth: 0, // 表格内容区域总宽度
        hiddenLeftStyle: { // 左侧隐藏样式
          width: `0px`,
        },
        hiddenRightStyle: { // 右侧隐藏样式
          width: `0px`,
        },
        colSize: [0, 0], // 可视区域显示的列号
      };
    }
    componentDidMount() {
      this.setVirtualSize();
      this.setHorizontalData();
      // 同步两边的滚动
      $('.pivot-table-body').on('scroll', this.asyncTableScroll);
    }
    asyncTableScroll() {
      var scrollLeft = $(this).prop('scrollLeft');
      $('.pivot-table-header').prop('scrollLeft', scrollLeft);
    }
    // 设置虚拟表格高度、宽度
    setVirtualSize(dom) {
      const virtualTable = dom || this.virtualTable;
      const width = virtualTable.clientWidth;
      if (width) {
        this.virtualTableWidth = width;
      }
    };

    // getVirtualTableRef(dom) {
    //   this.virtualTable = dom || this.virtualTable;
    //   this.setVirtualSize(dom);
    // };

    getTableHeaderDom(dom) {
      this.tableHeader = dom || this.tableHeader;
    };

    getVerticalDom(dom) {
      this.verticalDom = dom || this.verticalDom;
    };

    // 设置虚拟表格横向数据；在横向滚动时使用
    setHorizontalData() {
      const scrollLeft = this.horizontalDom && this.horizontalDom.scrollLeft;
      const pivotData = new PivotData(this.props);
      const rowAttrs = pivotData.props.rows;
      const colKeys = pivotData.getColKeys();
      const aggregatorGather = this.props.aggregatorGather;
      const part1 = rowAttrs.length ? rowAttrs : [undefined]
      const part2 = rowAttrs.length !== 0 && colKeys.length !== 0 ? [undefined] : []
      const part3 = colKeys
      const part4 = aggregatorGather
      const columns = [...part1, ...part2, ...part3, ...part4]
      const { colSize: oColSize } = this.state;
      // 表格内容可视区域的宽度
      const width = this.virtualTableWidth;
      const colSize = [];
      let totalWidth = 0;
      let hiddenLeftWidth = 0; // 左侧隐藏未被渲染的宽度
      let hiddenRigthWidth = 0; // 右侧隐藏未被渲染的宽度
      let currentStep = 0; // 0: 前面被隐藏阶段；1: 可视区域阶段；2: 后面不可见区域
      if (!width) {
        return;
      }
      columns.forEach((item, i) => {
        // const { width: colWidth = 150 } = item;
        const colWidth = 120
        totalWidth += colWidth;
        if (currentStep === 0) {
          if (totalWidth >= scrollLeft - OFFSET_HORIZONTAL) {
            // 根据 scrollLeft 算出可视区域起始行号
            colSize[0] = i;
            currentStep += 1;
          } else {
            hiddenLeftWidth += colWidth;
          }
        }
        if (currentStep === 1 && totalWidth > scrollLeft + width + OFFSET_HORIZONTAL) {
          // 计算出可视区域结束列号
          colSize[1] = i;
          currentStep += 1;
        }
        if (currentStep === 2) {
          hiddenRigthWidth += colWidth;
        }
      });

      if (oColSize.join() !== colSize.join()) {
        // 可视区域的列号有了变化才重新进行渲染
        this.setState({
          hiddenLeftStyle: { width: `${hiddenLeftWidth}px` },
          hiddenRightStyle: { width: `${hiddenRigthWidth}px` },
          colSize,
          totalWidth,
        });
      }
    };

    handleHorizontalScroll(e) {
      e.stopPropagation();
      const scrollLeft = e.target.scrollLeft;
      // this.scrollDom && (this.scrollDom.scrollLeft = scrollLeft);
      this.setHorizontalData();
    };

    handleBodyMouseEnter() {
      this.mousePosition = POSITION_TABLE_BODY;
    };

    tableHeaderRender() {
      const pivotData = new PivotData(this.props);
      const colAttrs = pivotData.props.cols.length ? concat(pivotData.props.cols, undefined) : [undefined, undefined];
      const rowAttrs = pivotData.props.rows;
      const colKeys = pivotData.getColKeys();
      const aggregatorGather = this.props.aggregatorGather;
      return (
        <div className="pivot-table-header">
          <table className="pivotTable">
            <colgroup>
              {
                rowAttrs.length === 0 && colKeys.length === 0 && (
                  <col style={{ width: '120px' }} />
                )
              }

              {(rowAttrs.length !== 0 && (
                rowAttrs.map((r, i) => {
                  return (
                    <col style={{ width: '120px' }} />
                  );
                })
              ))}
              {colKeys.length && (
                <col style={{ width: '120px' }} />
              ) || null}
              {colKeys.map((colKey, i) => {
                return (
                  <col style={{ width: '120px' }} />
                );
              })}
              {(
                aggregatorGather.map((_, o) => {
                  return (
                    <col style={{ width: '120px' }} />
                  )
                })
              ) || <React.Fragment />}
            </colgroup>
            <thead>
              {colAttrs.map((c, j) => {
                return (
                  <tr key={`${c}${j}`}>

                    {
                      rowAttrs.length === 0 && colKeys.length === 0 && (
                        <th colSpan={rowAttrs.length} rowSpan={colAttrs.length - 1} />
                      ) || null
                    }

                    {j === 0 && rowAttrs.length !== 0
                      && (
                        <th colSpan={rowAttrs.length} rowSpan={colAttrs.length - 1} style={{ position: 'sticky', zIndex: 2, left: 0, top: 0 }} />
                      )
                      || (rowAttrs.length !== 0 && j === colAttrs.length - 1 && (
                        rowAttrs.map((r, i) => {
                          return (
                            <th style={{ position: 'sticky', zIndex: 2, left: i * 120 + 'px' }} className="pivotAxisLabel" key={`rowAttr${i}`}>
                              {r}
                            </th>
                          );
                        })
                      ))}

                    {colKeys.length && (
                      <th style={{ position: 'sticky', zIndex: 2, left: rowAttrs.length * 120 + 'px', top: j * 30 + 'px' }} className="pvtAxisLabel">{c}</th>
                    ) || null}

                    {colKeys.map((colKey, i) => {
                      const x = spanSize(colKeys, i, j);
                      if (x === -1) {
                        return null;
                      }
                      return (
                        <th
                          className="pivotColLabel"
                          key={`colKey${i}${j}`}
                          colSpan={x}
                          style={{ position: 'sticky', zIndex: 1, top: j * 30 + 'px' }}
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
                      aggregatorGather.map((_, o) => {
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
      );
    };

    tableBodyRender() {
      const { hiddenBottomStyle, hiddenLeftStyle, hiddenRightStyle, colSize, totalHeight } = this.state;
      const pivotData = new PivotData(this.props);
      const colAttrs = pivotData.props.cols.length ? concat(pivotData.props.cols, undefined) : [undefined, undefined];
      const rowAttrs = pivotData.props.rows;
      const rowKeys = pivotData.getRowKeys();
      const colKeys = pivotData.getColKeys();
      const aggregatorGather = this.props.aggregatorGather;


      const part1 = rowAttrs.length ? rowAttrs : [undefined]
      const part2 = rowAttrs.length !== 0 && colKeys.length !== 0 ? [undefined] : []
      const part3 = colKeys
      const part4 = aggregatorGather
      const columns = [...part1, ...part2, ...part3, ...part4]

      // const showCols = columns.slice(...colSize);
      const showCols = columns;
      const cols = [];
      // if (colSize[0]) {
      //   cols.push(<col key="first" width={hiddenLeftStyle.width} />);
      // }
      showCols.forEach((col, i) => {
        const width = 120
        cols.push(<col key={`${colSize[0] + i}`} width={`${width}px`} />);
      });
      // if (colSize[1]) {
      //   cols.push(<col key="last" width={hiddenRightStyle.width} />);
      // }

      return (
        <div className="pivot-table-body" ref={this.getHorizontalDom} onMouseEnter={() => this.handleBodyMouseEnter()}>
          <div className="table-body-total">
            <table className="pivotTable">
              <colgroup>
                {cols}
              </colgroup>
              <thead>
                {colAttrs.map((c, j) => {
                  return (
                    <tr key={`${c}${j}`}>

                      {
                        rowAttrs.length === 0 && colKeys.length === 0 && (
                          <th colSpan={rowAttrs.length} rowSpan={colAttrs.length - 1} />
                        ) || null
                      }

                      {j === 0 && rowAttrs.length !== 0
                        && (
                          <th colSpan={rowAttrs.length} rowSpan={colAttrs.length - 1} style={{ position: 'sticky', zIndex: 3, left: 0, top: 0 }} />
                        )
                        || (rowAttrs.length !== 0 && j === colAttrs.length - 1 && (
                          rowAttrs.map((r, i) => {
                            return (
                              <th style={{ position: 'sticky', zIndex: 2, left: i * 120 + 'px', top: j * 30 + 'px' }} className="pivotAxisLabel" key={`rowAttr${i}`}>
                                {r}
                              </th>
                            );
                          })
                        ))}

                      {colKeys.length && (
                        <th style={{ position: 'sticky', zIndex: 2, left: rowAttrs.length * 120 + 'px', top: j * 30 + 'px' }} className="pvtAxisLabel">{c}</th>
                      ) || null}

                      {colKeys.map((colKey, i) => {
                        const x = spanSize(colKeys, i, j);
                        if (x === -1) {
                          return null;
                        }
                        return (
                          <th
                            className="pivotColLabel"
                            key={`colKey${i}${j}`}
                            colSpan={x}
                            style={{ position: 'sticky', zIndex: 1, top: j * 30 + 'px' }}
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
                          style={{ position: 'sticky', zIndex: 2, top: j * 30 + 'px' }}
                        >
                          Totals
                        </th>
                      ) || <React.Fragment />}

                      {/* total 细分维度 */}
                      {(j === colAttrs.length - 1) && (
                        aggregatorGather.map((_, o) => {
                          return (
                            <th
                              key={`Total${j}${o}`}
                              className="pivotColLabel pivotRowTotal"
                              style={{ position: 'sticky', zIndex: 2, top: j * 30 + 'px' }}
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
                {rowKeys.map((rowKey, i) => {
                  return (
                    <tr key={`rowKeyRow${i}`}>
                      {rowKey.length
                        &&
                        rowKey.map((txt, j) => {
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
                              style={{ position: 'sticky', zIndex: 1, left: (j) * 120 + 'px' }}
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
                      {colKeys.map((colKey, j) => {
                        const aggregator = pivotData.getAggregator(rowKey, colKey);
                        return (
                          <td
                            className="pivotVal"
                            key={`pivotVal${i}-${j}`}
                            onClick={
                              this.getClickHandler &&
                              this.getClickHandler(aggregator.value(), rowKey, colKey)
                            }
                            style={this.valueCellColors(
                              rowKey,
                              colKey,
                              aggregator.value()
                            )}
                          >
                            {aggregator.format(aggregator.value())}
                          </td>
                        );
                      })}
                      {aggregatorGather.map((_, j) => {
                        const totalAggregator = pivotData.getAggregator([...rowKey, _.aggregatorName], []);
                        return (<td
                          className="pivotTotal pivotRowTotal"
                          key={`pivotTotal${i}-${j}-${_.aggregatorName}`}
                          onClick={
                            this.getClickHandler &&
                            this.getClickHandler(totalAggregator.value(), rowKey, [null])
                          }
                          style={this.colTotalColors(totalAggregator.value())}
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

                  {colKeys.map((colKey, i) => {
                    const totalAggregator = pivotData.getAggregator([], colKey);
                    return (
                      <td
                        className="pivotTotal"
                        key={`total${i}`}
                        onClick={
                          this.getClickHandler &&
                          this.getClickHandler(totalAggregator.value(), [null], colKey)
                        }
                        style={this.rowTotalColors(totalAggregator.value())}
                      >
                        {totalAggregator.format(totalAggregator.value())}
                      </td>
                    );
                  })}

                  {(
                    aggregatorGather.map((_, o) => {
                      const grandTotalAggregator = pivotData.getAggregator([], [], _.aggregatorName);
                      return (
                        <td
                          key={`aggregatorGather${o}`}
                          onClick={
                            this.getClickHandler &&
                            this.getClickHandler(grandTotalAggregator.value(), [null], [null])
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
      );
    };

    handleScriptLoad() {
      $(document).ready(function () {
        $('.pivotTable').dataTable({ scrollY: '50vh', scrollCollapse: true, paging: false });
      });
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

      this.valueCellColors = () => { };
      this.rowTotalColors = () => { };
      this.colTotalColors = () => { };
      // todo
      if (opts.heatmapMode) {
        const colorScaleGenerator = this.props.tableColorScaleGenerator;
        if (opts.heatmapMode === 'full') {
          const allValues = [];
          rowKeys.map(r =>
            colKeys.map(c =>
              allValues.push(pivotData.getAggregator(r, c).value())
            )
          );
          const colorScale = colorScaleGenerator(allValues);
          this.valueCellColors = (r, c, v) => colorScale(v);
        } else if (opts.heatmapMode === 'row') {
          const rowColorScales = {};
          rowKeys.map(r => {
            const rowValues = colKeys.map(x =>
              pivotData.getAggregator(r, x).value()
            );
            rowColorScales[r] = colorScaleGenerator(rowValues);
          });
          this.valueCellColors = (r, c, v) => rowColorScales[r](v);
        } else if (opts.heatmapMode === 'col') {
          const colColorScales = {};
          colKeys.map(c => {
            const colValues = rowKeys.map(x =>
              pivotData.getAggregator(x, c).value()
            );
            colColorScales[c] = colorScaleGenerator(colValues);
          });
          this.valueCellColors = (r, c, v) => colColorScales[c](v);
        }
      }

      this.getClickHandler =
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
        <div className="use-virtual-table" ref={this.getVirtualTableRef} onScroll={(e) => this.handleHorizontalScroll(e)}>
          <div className="use-virtual-table-body">
            {/* {this.tableHeaderRender()} */}
            {this.tableBodyRender()}
          </div>
          {/* <div
            className="bar-virtual-vertical-scroll"
            style={{ height: `${this.virtualTableHeight - (this.tableHeader.clientHeight || 34)}px`, width: `${this.scrollBarWidth}px` }}
            onScroll={this.handleScroll}
            ref={this.getScrollDom}
            onMouseEnter={this.handleVerScrollMouseEnter}
          >
            <div className='bar-body' style={{ height: `${totalHeight}px` }} />
          </div> */}
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
