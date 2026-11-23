import { Search } from 'lucide-react';

export default function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="search-box">
      <Search size={17} />
      <span className="sr-only">{placeholder}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type="search" />
    </label>
  );
}
