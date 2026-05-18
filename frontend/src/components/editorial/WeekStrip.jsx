import React from 'react';

const WEEK_HI = ['सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'];

export default function WeekStrip({ weekDates = [], dotsByDay = {}, todayIdx }) {
  return (
    <div className="k-hero__weekstrip">
      {weekDates.map((d, i) => {
        const dots = dotsByDay[d.toDateString()] || 0;
        return (
          <div key={i} className={`k-week${i === todayIdx ? ' is-today' : ''}`}>
            <div className="k-week__hi">{WEEK_HI[i]}</div>
            <div className="k-week__num">{d.getDate()}</div>
            <div className="k-week__dots">
              {Array.from({ length: Math.min(dots, 4) }).map((_, j) => <i key={j} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
