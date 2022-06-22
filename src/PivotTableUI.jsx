import React from 'react';
import PropTypes from 'prop-types';
import update from 'immutability-helper';
import { PivotData, sortAs, getSort } from './Utilities';
import PivotTable from './PivotTable';
import Sortable from 'react-sortablejs';
import Draggable from 'react-draggable';
import { cloneDeep } from 'lodash';

/* eslint-disable react/prop-types */
// eslint can't see inherited propTypes!

const sortIcons = {
  key_a_to_z: {
    rowSymbol: '↕',
    colSymbol: '↔',
    next: 'value_a_to_z',
  },
  value_a_to_z: {
    rowSymbol: '↓',
    colSymbol: '→',
    next: 'value_z_to_a',
  },
  value_z_to_a: { rowSymbol: '↑', colSymbol: '←', next: 'key_a_to_z' },
  operation: {
    addSymbol: '＋',
    minusSymbol: '－',
  }
};

export class DraggableAttribute extends React.Component {
  constructor(props) {
    super(props);
    this.state = { open: false, filterText: '' };
  }

  toggleValue(value) {
    if (value in this.props.valueFilter) {
      this.props.removeValuesFromFilter(this.props.name, [value]);
    } else {
      this.props.addValuesToFilter(this.props.name, [value]);
    }
  }

  matchesFilter(x) {
    return x
      .toLowerCase()
      .trim()
      .includes(this.state.filterText.toLowerCase().trim());
  }

  selectOnly(e, value) {
    e.stopPropagation();
    this.props.setValuesInFilter(
      this.props.name,
      Object.keys(this.props.attrValues).filter(y => y !== value)
    );
  }

  getFilterBox() {
    const showMenu =
      Object.keys(this.props.attrValues).length < this.props.menuLimit;

    const values = Object.keys(this.props.attrValues);
    const shown = values
      .filter(this.matchesFilter.bind(this))
      .sort(this.props.sorter);

    return (
      <Draggable handle=".pvtDragHandle">
        <div
          className="pvtFilterBox"
          style={{
            display: 'block',
            cursor: 'initial',
            zIndex: this.props.zIndex,
          }}
          onClick={() => this.props.moveFilterBoxToTop(this.props.name)}
        >
          <div className="pvtTool">
            <span className="pvtDragHandle">☰</span>
            <a onClick={() => this.setState({ open: false })} className="pvtCloseX">
              ×
            </a>
          </div>
          <div className="pvtFieldTool">
            <div className="name">{this.props.name}</div>
            <a
              role="button"
              className="pvtRowOrder"
              onClick={() => {
                this.props.changeSorterFilter(
                  this.props.name,
                  this.props.sorterFilter[this.props.name] ? sortIcons[this.props.sorterFilter[this.props.name]].next : sortIcons['key_a_to_z'].next,
                  this.props.type
                )
              }
              }
            >
              {this.props.sorterFilter[this.props.name] ? sortIcons[this.props.sorterFilter[this.props.name]][this.props.type === 'cols' ? 'colSymbol' : 'rowSymbol'] : sortIcons['key_a_to_z'][this.props.type === 'cols' ? 'colSymbol' : 'rowSymbol']}
            </a>
          </div>

          {showMenu || <p>(too many values to show)</p>}

          {showMenu && (
            <p>
              <input
                type="text"
                placeholder="Filter values"
                className="pvtSearch"
                value={this.state.filterText}
                onChange={e =>
                  this.setState({
                    filterText: e.target.value,
                  })
                }
              />
              <br />
              <a
                role="button"
                className="pvtButton"
                onClick={() =>
                  this.props.removeValuesFromFilter(
                    this.props.name,
                    Object.keys(this.props.attrValues).filter(
                      this.matchesFilter.bind(this)
                    )
                  )
                }
              >
                Select {values.length === shown.length ? 'All' : shown.length}
              </a>{' '}
              <a
                role="button"
                className="pvtButton"
                onClick={() =>
                  this.props.addValuesToFilter(
                    this.props.name,
                    Object.keys(this.props.attrValues).filter(
                      this.matchesFilter.bind(this)
                    )
                  )
                }
              >
                Deselect {values.length === shown.length ? 'All' : shown.length}
              </a>
            </p>
          )}

          {showMenu && (
            <div className="pvtCheckContainer">
              {shown.map(x => (
                <p
                  key={x}
                  onClick={() => this.toggleValue(x)}
                  className={x in this.props.valueFilter ? '' : 'selected'}
                >
                  <a className="pvtOnly" onClick={e => this.selectOnly(e, x)}>
                    only
                  </a>
                  <a className="pvtOnlySpacer">&nbsp;</a>

                  {x === '' ? <em>null</em> : x}
                </p>
              ))}
            </div>
          )}
        </div>
      </Draggable >
    );
  }

  toggleFilterBox() {
    this.setState({ open: !this.state.open });
    this.props.moveFilterBoxToTop(this.props.name);
  }

  render() {
    const filtered =
      Object.keys(this.props.valueFilter).length !== 0
        ? 'pvtFilteredAttribute'
        : '';
    return (
      <li data-id={this.props.name}>
        <span className={'pvtAttr ' + filtered}>
          {this.props.name}
          <span
            className="pvtTriangle"
            onClick={this.toggleFilterBox.bind(this)}
          >
            {' '}
            ▾
          </span>
        </span>

        {this.state.open ? this.getFilterBox() : null}
      </li>
    );
  }
}

DraggableAttribute.defaultProps = {
  valueFilter: {},
  sorterFilter: {}
};

DraggableAttribute.propTypes = {
  name: PropTypes.string.isRequired,
  addValuesToFilter: PropTypes.func.isRequired,
  removeValuesFromFilter: PropTypes.func.isRequired,
  attrValues: PropTypes.objectOf(PropTypes.number),
  valueFilter: PropTypes.objectOf(PropTypes.bool),
  sorterFilter: PropTypes.object,
  moveFilterBoxToTop: PropTypes.func.isRequired,
  sorter: PropTypes.func.isRequired,
  menuLimit: PropTypes.number,
  zIndex: PropTypes.number,
};

export class Dropdown extends React.PureComponent {
  render() {
    return (
      <div className="pvtDropdown" style={{ zIndex: this.props.zIndex }}>
        <div
          onClick={e => {
            e.stopPropagation();
            this.props.toggle();
          }}
          className={
            'pvtDropdownValue pvtDropdownCurrent ' +
            (this.props.open ? 'pvtDropdownCurrentOpen' : '')
          }
          role="button"
        >
          <div className="pvtDropdownIcon">{this.props.open ? '×' : '▾'}</div>
          {this.props.current || <span>&nbsp;</span>}
        </div>

        {this.props.open && (
          <div className="pvtDropdownMenu">
            {this.props.values.map(r => (
              <div
                key={r}
                role="button"
                onClick={e => {
                  e.stopPropagation();
                  if (this.props.current === r) {
                    this.props.toggle();
                  } else {
                    this.props.setValue(r);
                  }
                }}
                className={
                  'pvtDropdownValue ' +
                  (r === this.props.current ? 'pvtDropdownActiveValue' : '')
                }
              >
                {r}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}

class PivotTableUI extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      unusedOrder: [],
      zIndices: {},
      maxZIndex: 1000,
      openDropdown: false,
      attrValues: {},
      materializedInput: [],
    };
  }

  componentDidMount() {
    this.materializeInput(this.props.data);
  }

  componentDidUpdate() {
    this.materializeInput(this.props.data);
  }

  materializeInput(nextData) {
    if (this.state.data === nextData) {
      return;
    }
    const newState = {
      data: nextData,
      attrValues: {},
      materializedInput: [],
    };
    let recordsProcessed = 0;
    PivotData.forEachRecord(
      newState.data,
      this.props.derivedAttributes,
      function (record) {
        newState.materializedInput.push(record);
        for (const attr of Object.keys(record)) {
          if (!(attr in newState.attrValues)) {
            newState.attrValues[attr] = {};
            if (recordsProcessed > 0) {
              newState.attrValues[attr].null = recordsProcessed;
            }
          }
        }
        for (const attr in newState.attrValues) {
          const value = attr in record ? record[attr] : 'null';
          if (!(value in newState.attrValues[attr])) {
            newState.attrValues[attr][value] = 0;
          }
          newState.attrValues[attr][value]++;
        }
        recordsProcessed++;
      }
    );
    this.setState(newState);
  }

  sendPropUpdate(command) {
    this.props.onChange(update(this.props, command));
  }

  propUpdater(key) {
    return value => this.sendPropUpdate({ [key]: { $set: value } });
  }

  setValuesInFilter(attribute, values) {
    this.sendPropUpdate({
      valueFilter: {
        [attribute]: {
          $set: values.reduce((r, v) => {
            r[v] = true;
            return r;
          }, {}),
        },
      },
    });
  }

  addValuesToFilter(attribute, values) {
    if (attribute in this.props.valueFilter) {
      this.sendPropUpdate({
        valueFilter: {
          [attribute]: values.reduce((r, v) => {
            r[v] = { $set: true };
            return r;
          }, {}),
        }
      });
    } else {
      this.setValuesInFilter(attribute, values);
    }
  }

  removeValuesFromFilter(attribute, values) {
    this.sendPropUpdate({
      valueFilter: { [attribute]: { $unset: values } },
    });
  }

  changeSorterFilter(attribute, values, type) {
    let aggregatorGather = this.props.aggregatorGather.map(item => {
      item[type === 'cols' ? 'colOrder' : 'rowOrder'] = 'key_a_to_z'
      return item;
    })
    this.sendPropUpdate({
      sorterFilter: {
        $merge: {
          [attribute]: values
        }
      },
      aggregatorGather: { $set: aggregatorGather }
    });
  }

  moveFilterBoxToTop(attribute) {
    this.setState(
      update(this.state, {
        maxZIndex: { $set: this.state.maxZIndex + 1 },
        zIndices: { [attribute]: { $set: this.state.maxZIndex + 1 } },
      })
    );
  }

  isOpen(dropdown) {
    return this.state.openDropdown === dropdown;
  }

  makeDnDCell(items, onChange, classes, name, type) {
    return (
      <div className={classes}>
        <div className="name">{name}</div>
        <Sortable
          options={{
            group: 'shared',
            ghostClass: 'pvtPlaceholder',
            filter: '.pvtFilterBox',
            preventOnFilter: false,
          }}
          tag="div"
          // className={ }
          onChange={onChange}
        >
          {items.map(x => (
            <DraggableAttribute
              name={x}
              key={x}
              type={type}
              attrValues={this.state.attrValues[x]}
              valueFilter={this.props.valueFilter[x] || {}}
              sorterFilter={this.props.sorterFilter || {}}
              sorter={getSort(this.props.sorters, x)}
              menuLimit={this.props.menuLimit}
              changeSorterFilter={this.changeSorterFilter.bind(this)}
              setValuesInFilter={this.setValuesInFilter.bind(this)}
              addValuesToFilter={this.addValuesToFilter.bind(this)}
              moveFilterBoxToTop={this.moveFilterBoxToTop.bind(this)}
              removeValuesFromFilter={this.removeValuesFromFilter.bind(this)}
              zIndex={this.state.zIndices[x] || this.state.maxZIndex}
            />
          ))}
        </Sortable>
      </div>
    );
  }

  render() {
    // const numValsAllowed =
    //   this.props.aggregators[this.props.aggregatorName]([])().numInputs || 0;

    // const aggregatorCellOutlet = this.props.aggregators[
    //   this.props.aggregatorName
    // ]([])().outlet;

    const rendererName =
      this.props.rendererName in this.props.renderers
        ? this.props.rendererName
        : Object.keys(this.props.renderers)[0];

    const rendererCell = (
      <td className="pvtRenderers">
        <Dropdown
          current={rendererName}
          values={Object.keys(this.props.renderers)}
          open={this.isOpen('renderer')}
          zIndex={this.isOpen('renderer') ? this.state.maxZIndex + 1 : 1}
          toggle={() =>
            this.setState({
              openDropdown: this.isOpen('renderer') ? false : 'renderer',
            })
          }
          setValue={this.propUpdater('rendererName')}
        />
      </td>
    );

    const aggregatorCell = (
      <div className="pvtVals">
        <div className="name">Values</div>
        <div>
          {
            this.props.aggregatorGather.map((item, index) => {
              const numValsAllowed =
                this.props.aggregators[item.aggregatorName]([])().numInputs || 0;
              const aggregatorCellOutlet = this.props.aggregators[
                item.aggregatorName
              ]([])().outlet;
              return (
                <div key={index}>
                  <Dropdown
                    current={item.aggregatorName}
                    values={Object.keys(this.props.aggregators)}
                    open={this.isOpen(`aggregators${index}`)}
                    zIndex={this.isOpen(`aggregators${index}`) ? this.state.maxZIndex + 1 : 1}
                    toggle={() =>
                      this.setState({
                        openDropdown: this.isOpen(`aggregators${index}`) ? false : `aggregators${index}`,
                      })
                    }
                    setValue={
                      value =>
                        this.sendPropUpdate({
                          aggregatorGather: { [index]: { aggregatorName: { $set: value } } },
                        })
                    }
                  />
                  <a
                    role="button"
                    className="pvtRowOrder"
                    onClick={() => {
                      let sorterFilter = cloneDeep(this.props.sorterFilter)
                      this.props.rows.forEach(ele => {
                        if (sorterFilter[ele]) {
                          delete sorterFilter[ele]
                        }
                      })
                      this.sendPropUpdate({
                        aggregatorGather: { [index]: { rowOrder: { $set: sortIcons[item.rowOrder].next } } },
                        sorterFilter: { $set: sorterFilter }
                      })
                    }
                    }
                  >
                    {sortIcons[item.rowOrder].rowSymbol}
                  </a>
                  <a
                    role="button"
                    className="pvtColOrder"
                    onClick={() => {
                      let sorterFilter = cloneDeep(this.props.sorterFilter)
                      this.props.cols.forEach(ele => {
                        if (sorterFilter[ele]) {
                          delete sorterFilter[ele]
                        }
                      })
                      this.sendPropUpdate({
                        aggregatorGather: { [index]: { colOrder: { $set: sortIcons[item.colOrder].next } } },
                        sorterFilter: { $set: sorterFilter }
                      })
                    }
                    }
                  >
                    {sortIcons[item.colOrder].colSymbol}
                  </a>
                  {/* add */}
                  {index === 0 && (
                    <a
                      role="button"
                      className="pvtColOrder"
                      onClick={() =>
                        this.sendPropUpdate({
                          aggregatorGather: {
                            $push: [{
                              aggregatorName: 'Sum',
                              vals: [],
                              colOrder: 'key_a_to_z',
                              rowOrder: 'key_a_to_z'
                            }]
                          }
                        })
                      }
                    >
                      {sortIcons['operation']['addSymbol']}
                    </a>
                  )}
                  {/* minus */}
                  {index !== 0 && (
                    <a
                      role="button"
                      className="pvtColOrder"
                      onClick={() =>
                        this.sendPropUpdate({
                          aggregatorGather: { $splice: [[index, 1]] },
                        })
                      }
                    >
                      {sortIcons['operation']['minusSymbol']}
                    </a>
                  )}
                  {numValsAllowed > 0 && <br />}
                  {new Array(numValsAllowed).fill().map((n, i) => [
                    <Dropdown
                      key={i}
                      current={item.vals[i]}
                      values={Object.keys(this.state.attrValues).filter(
                        e =>
                          !this.props.hiddenAttributes.includes(e) &&
                          !this.props.hiddenFromAggregators.includes(e)
                      )}
                      open={this.isOpen(`val${i}${index}`)}
                      zIndex={this.isOpen(`val${i}${index}`) ? this.state.maxZIndex + 1 : 1}
                      toggle={() =>
                        this.setState({
                          openDropdown: this.isOpen(`val${i}${index}`) ? false : `val${i}${index}`,
                        })
                      }
                      setValue={value =>
                        this.sendPropUpdate({
                          aggregatorGather: { [index]: { vals: { $splice: [[i, 1, value]] } } },
                        })
                      }
                    />,
                    i + 1 !== numValsAllowed ? <br key={`br${i}`} /> : null,
                  ])}
                  {aggregatorCellOutlet && aggregatorCellOutlet(this.props.data)}
                </div>)
            })
          }
        </div>
      </div>
    );

    const unusedAttrs = Object.keys(this.state.attrValues)
      .filter(
        e =>
          !this.props.rows.includes(e) &&
          !this.props.cols.includes(e) &&
          !this.props.hiddenAttributes.includes(e) &&
          !this.props.hiddenFromDragDrop.includes(e)
      )
      .sort(sortAs(this.state.unusedOrder));

    const unusedLength = unusedAttrs.reduce((r, e) => r + e.length, 0);
    const horizUnused = unusedLength < this.props.unusedOrientationCutoff;

    const unusedAttrsCell = this.makeDnDCell(
      unusedAttrs,
      order => this.setState({ unusedOrder: order }),
      `pvtAxisContainer pvtUnused ${horizUnused ? 'pvtHorizList' : 'pvtVertList'
      }`,
      'Data'
    );

    const colAttrs = this.props.cols.filter(
      e =>
        !this.props.hiddenAttributes.includes(e) &&
        !this.props.hiddenFromDragDrop.includes(e)
    );

    const colAttrsCell = this.makeDnDCell(
      colAttrs,
      this.propUpdater('cols'),
      'pvtAxisContainer pvtHorizList pvtCols',
      'Column',
      'cols'
    );

    const rowAttrs = this.props.rows.filter(
      e =>
        !this.props.hiddenAttributes.includes(e) &&
        !this.props.hiddenFromDragDrop.includes(e)
    );
    const rowAttrsCell = this.makeDnDCell(
      rowAttrs,
      this.propUpdater('rows'),
      'pvtAxisContainer pvtVertList pvtRows',
      'Row',
      'rows'
    );
    const outputCell = (
      <div className="pvtOutput">
        <PivotTable
          {...update(this.props, {
            data: { $set: this.state.materializedInput },
          })}
        />
      </div>
    );

    if (this.props.controls.enabled) {
      return (
        <div className="pvtUi" onClick={() => this.setState({ openDropdown: false })}>
          {outputCell}
        </div>
      )
    } else {
      return (
        <div className="pvtUi" onClick={() => this.setState({ openDropdown: false })}>
          {/* {rendererCell} */}
          <div className="pvt-data">
            {unusedAttrsCell}
          </div>
          <div className="pvt-others">
            <div className="pvt-others-left">
              {aggregatorCell}
              {colAttrsCell}
            </div>
            <div className="pvt-others-right">
              {rowAttrsCell}
              <div className="pvtAxisContainer pvt-output">
                {outputCell}
              </div>
            </div>
          </div>
        </div>
      )
    }
    // <table className="pvtUi">
    //   <tbody onClick={() => this.setState({ openDropdown: false })}>
    //     <tr>
    //       {rendererCell}
    //       {unusedAttrsCell}
    //     </tr>
    //     <tr>
    //       {aggregatorCell}
    //       {colAttrsCell}
    //     </tr>
    //     <tr>
    //       {rowAttrsCell}
    //       {outputCell}
    //     </tr>
    //   </tbody>
    // </table>
    // }

    // return (
    //   <table className="pvtUi">
    //     <tbody onClick={() => this.setState({ openDropdown: false })}>
    //       <tr>
    //         {rendererCell}
    //         {aggregatorCell}
    //         {colAttrsCell}
    //       </tr>
    //       <tr>
    //         {unusedAttrsCell}
    //         {rowAttrsCell}
    //         {outputCell}
    //       </tr>
    //     </tbody>
    //   </table>
    // );
  }
}

PivotTableUI.propTypes = Object.assign({}, PivotTable.propTypes, {
  onChange: PropTypes.func.isRequired,
  hiddenAttributes: PropTypes.arrayOf(PropTypes.string),
  hiddenFromAggregators: PropTypes.arrayOf(PropTypes.string),
  hiddenFromDragDrop: PropTypes.arrayOf(PropTypes.string),
  unusedOrientationCutoff: PropTypes.number,
  menuLimit: PropTypes.number,
});

PivotTableUI.defaultProps = Object.assign({}, PivotTable.defaultProps, {
  hiddenAttributes: [],
  hiddenFromAggregators: [],
  hiddenFromDragDrop: [],
  unusedOrientationCutoff: 85,
  menuLimit: 500,
});

export default PivotTableUI;
