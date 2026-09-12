import { visualCssVars } from '../lib/visualState';

const bubbles = Array.from({ length: 12 });
const algae = Array.from({ length: 9 });
const particles = Array.from({ length: 8 });
const glints = Array.from({ length: 7 });

export default function LivingPond({ snapshot, visual, compact = false, showCallouts = true, title }) {
  const d = snapshot.dashboard;
  const iot = snapshot.iot;
  const alerting = visual.warningSeverity > 0 || d.health_score < 75;
  return (
    <section className={`living-pond ${compact ? 'pond-compact' : ''} state-${visual.healthMode} severity-${d.anomaly_severity} ${visual.recovering ? 'is-recovering' : ''}`} style={visualCssVars(visual)}>
      <div className="pond-sky"><span className="sun"/><span className="cloud cloud-one"/><span className="cloud cloud-two"/><span className="sky-rays"/></div>
      <div className="stress-haze"/><div className="distant-hills"><i/><i/><i/></div>
      <div className="pond-reeds reeds-left">{Array.from({ length: 7 }, (_, n) => <i key={n}/>)}</div>
      <div className="pond-reeds reeds-right">{Array.from({ length: 6 }, (_, n) => <i key={n}/>)}</div>
      <div className="butterflies"><i/><i/><i/><i/><i/></div>
      <div className="co2-flow">{particles.map((_, n) => <i key={n} style={{ '--i': n }}/>)}</div>
      <div className="water-body">
        <div className="water-depth"/><div className="water-shine"/>
        <div className="anime-glints">{glints.map((_, n) => <i key={n} style={{ '--i': n }}/>)}</div>
        <div className="hazard-zone"><i/><i/><span>stress zone</span></div>
        <div className="algae-field">{algae.map((_, n) => <i key={n} style={{ '--i': n }}/>)}</div>
        <div className="lily-field"><i/><i/><i/><i/><i/><span><b/><b/><b/><b/><em/></span></div>
        <div className="fish fish-one"><i/><b/><span/></div>
        <div className="fish fish-two"><i/><b/><span/></div>
        <div className="fish fish-three"><i/><b/><span/></div>
        <div className="oxygen-bubbles">{bubbles.map((_, n) => <i key={n} style={{ '--i': n }}/>)}</div>
      </div>
      <div className="gas-release" aria-label="Gas exchange at the pond surface">{Array.from({ length: visual.gasBubbleCount }, (_, n) => <i key={n} style={{ '--i': n }}/>) }<b className="gas-label">{Math.round(visual.co2Ppm)} ppm CO2</b></div>
      <div className="shore-stones"><i/><i/><i/><i/><i/></div>
      <div className="pond-bank pond-bank-front"><i/><i/><i/><i/></div>
      <div className="bank-flowers"><span/><span/><span/><span/><i/><i/></div>
      {title && <div className="scene-title"><span>Live ecosystem</span><b>{title}</b></div>}
      {alerting && <div className="warning-beacon"><span><i/>!</span><div><small>{d.anomaly_severity} anomaly</small><b>{Math.round(d.anomaly_probability * 100)}% model probability</b></div></div>}
      {showCallouts && <>
        <div className="scene-callout callout-algae"><span className="callout-dot"/><small>Algae canopy</small><b>{d.chlorophyll_a.toFixed(1)} ug/L</b></div>
        <div className="scene-callout callout-co2"><span className="callout-dot"/><small>CO2 uptake</small><b>{(d.gross_co2_uptake_rate_g_l_h * 1000).toFixed(1)} mg/L/h</b></div>
        <div className={`scene-callout callout-oxygen ${iot.do_mg_l < 6 ? 'callout-alert' : ''}`}><span className="callout-dot"/><small>Dissolved oxygen</small><b>{iot.do_mg_l.toFixed(1)} mg/L</b></div>
        <div className={`scene-callout callout-clarity ${d.turbidity > 40 ? 'callout-alert' : ''}`}><span className="callout-dot"/><small>Water clarity</small><b>{d.turbidity.toFixed(1)} NTU</b></div>
      </>}
    </section>
  );
}
