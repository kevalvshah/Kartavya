import React from 'react';
import WeekStrip from './WeekStrip';

export default function Hero({ name, dateLine, lede, weekDates, dotsByDay, todayIdx }) {
  return (
    <section className="k-hero">
      <div className="k-hero__watermark" aria-hidden="true">कर्तव्य</div>
      <div className="k-hero__inner">
        {dateLine && (
          <div className="k-hero__meta">
            {dateLine.map((seg, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="k-hero__sep">·</span>}
                <span className={seg.hindi ? 'k-hero__samvat' : 'k-hero__date'}>{seg.label}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        <h1 className="k-hero__h1">
          <span className="k-hero__greet">नमस्ते,</span>
          <span className="k-hero__name"> {name}.</span>
        </h1>
        {lede && <p className="k-hero__lede">{lede}</p>}
        <WeekStrip weekDates={weekDates} dotsByDay={dotsByDay} todayIdx={todayIdx} />
      </div>
    </section>
  );
}
