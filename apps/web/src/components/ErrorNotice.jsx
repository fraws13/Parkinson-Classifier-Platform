export default function ErrorNotice({ children }) {
  return children ? <div className="notice error" role="alert">{children}</div> : null;
}
