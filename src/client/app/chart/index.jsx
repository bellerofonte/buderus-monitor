/***********************************************************************************

This is first attempt to make charts
Actually chart works, but there is several penalties:
1) It does not look good. It stil is not that bad, but IMHO is unacceptable.
2) Rechart makes WebUI load for several seconds even on powerful smartphone

I decided to comment out all chart stuff to leave WebUI tiny and lightweight.

 ***********************************************************************************/


// import React from 'react';
// import {LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip} from 'recharts';
// import Moment from 'moment';
// import css from './index.css';
//
// const ChartLineProps = {
//     dot: false,
//     activeDot: false,
//     isAnimationActive: false,
//     type: 'linear',
//     connectNulls: true
// };
//
// const rightAxisKeys = {
//     water: true
// };
//
// const curveProps = [
//     {stroke: '#78bb92'},
//     {stroke: '#2b83c2', strokeWidth: 2},
//     {stroke: '#c2686f'},
//     {stroke: '#666666', strokeDasharray: '5 3'}
// ];
//
// const timeFormats = {
//     '24h': 'HH:mm',
//     '1w': 'HH:mm',
//     '1m': 'dd.MM',
//     '3m': 'dd.MM',
//     '1y': 'dd.MM'
// };
//
// export default class extends React.Component {
//     constructor(props) {
//         super(props);
//         this.state = {
//             width: 100,
//             height: 100
//         };
//         this.handleRef = e => {
//             if (!e) return;
//             const {width, height} = e.getBoundingClientRect();
//             this.setState({width, height});
//         };
//     }
//
//     makeTime(time, interval, period) {
//         return new Moment(time * interval).format(timeFormats[period]);
//     }
//
//     renderError(error) {
//         return error;
//     }
//
//     renderChart(data, period) {
//         const {width, height} = this.state;
//         const {interval, rows} = data;
//         if (!rows || rows.length < 1) {
//             return this.renderError('No data to show');
//         }
//         const points = rows.map(row => ({
//             ...row,
//             time: this.makeTime(row.time, interval, period)
//         }));
//         const keys = Object.keys(points[0]).filter(key => key !== 'time');
//         const mml = points.reduce((res, point) => {
//             keys.filter(key => !rightAxisKeys[key]).forEach(key => {
//                 const value = point[key];
//                 res.min = Math.min(res.min, value);
//                 res.max = Math.max(res.max, value);
//             });
//             return res;
//         }, {min: 100000, max: -100000});
//         const mmr = points.reduce((res, point) => {
//             keys.filter(key => rightAxisKeys[key]).forEach(key => {
//                 const value = point[key];
//                 res.min = Math.min(res.min, value);
//                 res.max = Math.max(res.max, value);
//             });
//             return res;
//         }, {min: 100000, max: -100000});
//         const linesLeft = keys
//             .filter(key => !rightAxisKeys[key])
//             .map((key, idx) => <Line key={key} name={key} dataKey={key} yAxisId="left" {...curveProps[idx]} {...ChartLineProps} />);
//         const add = linesLeft.length;
//         const linesRight = keys
//             .filter(key => rightAxisKeys[key])
//             .map((key, idx) => <Line key={key} name={key} dataKey={key} yAxisId="right" {...curveProps[add + idx]} {...ChartLineProps}/>);
//         return (
//             <LineChart width={width} height={height} data={points}>
//                 <XAxis dataKey="time"/>
//                 <YAxis yAxisId="left" type="number" tickCount={5} width={height / 25}
//                        domain={[
//                            dmin => Math.floor(Math.max(dmin, mml.min)),
//                            dmax => Math.ceil(Math.min(dmax, mml.max))
//                        ]}/>
//                 {linesRight.length > 0 &&
//                 <YAxis yAxisId="right" type="number" tickCount={5} width={height / 25} orientation="right"
//                        domain={[
//                            dmin => Math.floor(Math.max(dmin, mmr.min)),
//                            dmax => Math.ceil(Math.min(dmax, mmr.max))
//                        ]}/>
//                 }
//                 <CartesianGrid strokeDasharray="3 5"/>
//                 <Tooltip/>
//                 {linesLeft}
//                 {linesRight}
//             </LineChart>
//         );
//     }
//
//     render() {
//         const {data, period} = this.props;
//         const error = data === null
//             ? 'No data to show'
//             : ((typeof data === 'string')
//                 ? data
//                 : (data.message !== undefined ? data.message : null));
//         const content = error ? this.renderError(error) : this.renderChart(data, period);
//         return (
//             <div className={css.chartBox} ref={this.handleRef}>
//                 {content}
//             </div>
//         );
//     }
// }
