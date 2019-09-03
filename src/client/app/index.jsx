import React from 'react';
import ListItem from './list-item';
import axios from 'axios';
import css from './index.css';

export default class extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            data: {},
            loading: false
        };
        this.refreshState = () => {
            if (this.state.loading) return;
            this.setState({loading: true}, () => {
                axios.get('/state')
                    .then(res => this.setState({loading: false, data: res.data}))
                    .catch(err => {
                        this.setState({loading: false, data: {Error: [err.message || 'Request failed']}});
                        console.log(err);
                    });
            });
        };
    }

    componentDidMount() {
        this.refreshState();
    }

    render() {
        const {TempOutdoor, Error, ...zones} = this.state.data;
        const lines = [];
        if (TempOutdoor) {
            lines.push(<ListItem key="Outdoor" name="Outdoor" tempReal={TempOutdoor} />);
        }
        Object.keys(zones).forEach(name => lines.push(
            <ListItem key={name} name={name} {...zones[name]} />
        ));
        if (Error && Error.length > 0) {
            const errLines = Error.map((err, idx) => (
                <div key={`err${idx}`}>
                    <i className="fas fa-exclamation-circle" style={{color: '#666'}} />{'\xa0' + err}
                </div>
            ));
            lines.push(
                <li key="Error">
                    {errLines}
                </li>
            );
        }
        return (
            <div className={css.container}>
                <div className={css.content}>
                    <div className={css.header}>
                        <img src="buderus-logo.png"/>
                    </div>
                    <ul className={css.list}>
                        {lines}
                    </ul>
                    <div className={css.buttons}>
                        <a onClick={this.refreshState}>
                            {this.state.loading
                                ? <i className="fas fa-spinner fa-pulse"/>
                                : 'Refresh'
                            }
                        </a>
                        <a>
                            Chart
                        </a>
                    </div>
                </div>
            </div>
        );
    }
}
