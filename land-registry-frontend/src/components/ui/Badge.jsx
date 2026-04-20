import { C } from "../../styles/tokens";

const STATUS_MAP = {
  ACTIVE:      { bg: C.successLt, color: C.success  },
  ENCUMBERED:  { bg: C.warnLt,    color: C.warn     },
  DISPUTED:    { bg: C.dangerLt,  color: C.danger   },
  INACTIVE:    { bg: "#F1F5F9",   color: "#64748B"  },
  PENDING:     { bg: "#EFF6FF",   color: "#1D4ED8"  },
  APPROVED:    { bg: C.successLt, color: C.success  },
  REJECTED:    { bg: C.dangerLt,  color: C.danger   },
  CANCELLED:   { bg: "#F1F5F9",   color: "#64748B"  },
  DISCHARGED:  { bg: "#F1F5F9",   color: "#64748B"  },
  MORTGAGE:    { bg: C.warnLt,    color: C.warn     },
  LIEN:        { bg: C.dangerLt,  color: C.danger   },
  CAVEAT:      { bg: "#FDF4FF",   color: "#7E22CE"  },
  EASEMENT:    { bg: "#F0FDF4",   color: "#15803D"  },
};

export default function Badge({ status, label }) {
  const { bg, color } = STATUS_MAP[status] || { bg: "#F1F5F9", color: "#64748B" };
  return (
    <span style={{
      background: bg, color,
      padding: "2px 10px", borderRadius: 20,
      fontSize: 12, fontWeight: 500,
      display: "inline-block", letterSpacing: "0.02em",
    }}>
      {label || status}
    </span>
  );
}
