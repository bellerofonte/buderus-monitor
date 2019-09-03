import React from 'react';
import css from './index.css';

export default ({name, tempReal, tempSet, auto, day, summer, vacation}) => {
    return (
        <li className={css.listItem}>
            <div className={css.listItemTitle}>{name}</div>
            <div className={css.listItemReal}>{`${tempReal}°`}</div>
            <div className={css.listItemSet}>
                {tempSet ? `${tempSet}°` : ''}
            </div>
            <div className={css.listItemAuto}>
                <i className={auto === undefined ? 'fas fa-fw' : (auto ? 'fas fa-fw fa-robot' : 'fas fa-fw fa-hand-paper')}/>
            </div>
            <div className={css.listItemVacation}>
                {vacation === undefined
                    ? <i className="fas fa-fw" />
                    : <i className="fas fa-fw fa-suitcase" style={vacation ? {} : {color: '#eee'}} />
                }
            </div>
            <div className={css.listItemSummer}>
                {summer === undefined
                    ? <i className="fas fa-fw" />
                    : <i className="fas fa-fw fa-umbrella-beach" style={summer ? {} :  {color: '#eee'}} />
                }
            </div>
            <div className={css.listItemDay}>
                <i className={day === undefined ? 'fas fa-fw' : (day ? 'fas fa-fw fa-sun' : 'fas fa-fw fa-moon')}/>
            </div>
        </li>
    )
}