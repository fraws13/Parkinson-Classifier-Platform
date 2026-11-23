export default function StatCard({ icon: Icon, title, value, note, accent }) {
  return (
    <article className={`stat ${accent || ''}`}>
      <div className="stat-top"><span>{title}</span><Icon size={19} /></div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
