import React from "react";

export function Panel({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-header">
        <div>
          <h3>{title}</h3>
          {subtitle && (typeof subtitle === "string" ? <p>{subtitle}</p> : <div style={{ marginTop: "5px" }}>{subtitle}</div>)}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Badge({ status }) {
  return <span className={`badge ${String(status).toLowerCase().replace(" ", "-")}`}>{status}</span>;
}

export function Stats({ items }) {
  return (
    <div className="stats">
      {items.map((item, index) => (
        <div className="stat-card" key={index}>
          <div className="stat-main">
            <div className="stat-label-row">
              <div className={`stat-icon ${item.color || "blue"}`}>{item.icon}</div>
              <div className="stat-meta">
                <span>{item.label}</span>
                {item.sub && <small>{item.sub}</small>}
              </div>
            </div>
            <h2>{item.value}</h2>
          </div>
          {item.action && <div className="stat-action">{item.action}</div>}
        </div>
      ))}
    </div>
  );
}

export function Empty({ text = "No data available" }) {
  return <div className="empty">{text}</div>;
}

export function Pagination({ page, setPage, total, perPage = 5 }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (total <= perPage) return null;

  return (
    <div className="pagination">
      <button className="secondary small" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button className="secondary small" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</button>
    </div>
  );
}

export function ResponsiveTable({ children, className = "" }) {
  const tableSections = React.Children.toArray(children);
  const header = tableSections.find(
    (section) => React.isValidElement(section) && section.type === "thead"
  );
  const headerRow = header && React.Children.toArray(header.props.children).find(
    (row) => React.isValidElement(row) && row.type === "tr"
  );
  const labels = headerRow ? React.Children.toArray(headerRow.props.children).map(
    (cell) => React.isValidElement(cell) ? cell.props.children : null
  ) : [];

  const rowsWithLabels = tableSections.map((section) => {
    if (!React.isValidElement(section) || section.type !== "tbody") return section;

    const rows = React.Children.map(section.props.children, (row) => {
      if (!React.isValidElement(row) || row.type !== "tr") return row;

      const cells = React.Children.map(row.props.children, (cell, index) => {
        if (!React.isValidElement(cell) || cell.type !== "td") return cell;

        const cellClassName = [cell.props.className, cell.props.colSpan > 1 && "mobile-full-cell"]
          .filter(Boolean)
          .join(" ");
        if (cell.props.colSpan > 1) return React.cloneElement(cell, { className: cellClassName });

        return React.cloneElement(
          cell,
          { className: cellClassName },
          <>
            {labels[index] != null && <span className="mobile-cell-label">{labels[index]}</span>}
            <span className="cell-value">{cell.props.children}</span>
          </>
        );
      });

      return React.cloneElement(row, null, cells);
    });

    return React.cloneElement(section, null, rows);
  });

  return <table role="table" className={`responsive-table ${className}`.trim()}>{rowsWithLabels}</table>;
}