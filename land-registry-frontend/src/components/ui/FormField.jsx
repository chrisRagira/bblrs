/** Text / number / email / password / date input */
export function FormField({
  label, name, type = "text", placeholder,
  value, onChange,onBlur, required,
  helper, icon, className = "",
}) {
  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="form-label" htmlFor={name}>
          {label}
          {required && <span className="required"> *</span>}
        </label>
      )}
      <div className="input-wrapper">
        {icon && <span className="input-icon">{icon}</span>}
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          required={required}
          className={`form-control${icon ? " form-control--icon" : ""}`}
        />
      </div>
      {helper && <p className="form-helper" style={{color: helper ? "#dc2626":"#6b7280"}}>{helper}</p>}
    </div>
  );
}

/** Select / dropdown */
export function SelectField({
  label, name, value, onChange, options = [], required, className = "",
}) {
  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="form-label" htmlFor={name}>
          {label}
          {required && <span className="required"> *</span>}
        </label>
      )}
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="form-control"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/** Textarea */
export function TextArea({
  label, name, value, onChange,
  placeholder, rows = 4, required, className = "",
}) {
  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="form-label" htmlFor={name}>
          {label}
          {required && <span className="required"> *</span>}
        </label>
      )}
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className="form-control"
        style={{ resize: "vertical" }}
      />
    </div>
  );
}
