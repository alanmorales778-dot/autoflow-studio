'use client';

import { useState } from 'react';

const legend = { fontWeight: 600, fontSize: 13, color: 'var(--ink-2)', marginBottom: 6, padding: 0 };

// Fecha y horario juntos: con cupo por horario, al cambiar el día se muestran solo los horarios con lugar.
export default function DateSlotPicker({ dates, allSlots, perSlot, title = 'Fecha' }) {
  const [picked, setDate] = useState(dates[0]?.date);
  // Si cambia la cantidad y el día elegido ya no tiene lugar, pasamos al primero disponible.
  const date = dates.some((d) => d.date === picked) ? picked : dates[0]?.date;
  const day = dates.find((d) => d.date === date) || dates[0];
  const slots = day?.slots || allSlots.map((s) => ({ slot: s, left: null }));
  const firstOpen = slots.find((s) => s.left === null || s.left > 0)?.slot;

  return (
    <>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 14px' }}>
        <legend style={legend}>{title} · solo ves días con lugar</legend>
        <div className="dates">
          {dates.map((d) => (
            <label key={d.date} className="date-opt" style={{ margin: 0 }}>
              <input type="radio" name="date" value={d.date} required checked={d.date === date} onChange={() => setDate(d.date)} />
              <span>
                <span className="wd">{d.wd}</span>
                <span className="dn">{d.dn}</span>
                <span className={`lf ${d.left !== null && d.left <= 1 ? 'low' : ''}`}>{d.left === null ? d.dm : d.left <= 1 ? 'Queda 1' : d.left <= 3 ? `Quedan ${d.left}` : d.dm}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {allSlots.length > 0 && (
        <fieldset key={date} className="field" style={{ border: 0, padding: 0, margin: '0 0 14px' }}>
          <legend style={legend}>Horario{perSlot ? ' · los ocupados aparecen tachados' : ''}</legend>
          <div className="dates">
            {slots.map((s) => {
              const full = s.left !== null && s.left <= 0;
              return (
                <label key={s.slot} className={`date-opt ${full ? 'full' : ''}`} style={{ margin: 0 }}>
                  <input type="radio" name="slot" value={s.slot} required disabled={full} defaultChecked={s.slot === firstOpen} />
                  <span style={{ minWidth: 104, padding: '12px 14px', fontWeight: 600, fontSize: 15 }}>
                    {s.slot}
                    {perSlot && <small className="lf" style={{ display: "block", fontWeight: 500 }}>{full ? "Ocupado" : s.left === 1 ? "Queda 1 lugar" : `${s.left} lugares`}</small>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </>
  );
}
