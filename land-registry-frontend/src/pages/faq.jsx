import { useState } from "react";
import { C, font } from "../styles/tokens";
import Button from "../components/ui/Button";
import { Link, useNavigate } from "react-router-dom";

const FAQS = [
  {
    q: "How do I verify a land title?",
    a: "Enter the title number or upload the document hash on the verification page. The system checks the blockchain and IPFS records instantly.",
    solution: "Go to the verification page and paste the title number or CID.",
    action: "/verify",
    actionLabel: "Verify Document"
  },
  {
    q: "What should I do if my parcel is not found?",
    a: "This may mean the parcel has not yet been digitized or registered in the system.",
    solution: "Contact your local land registry office or request parcel registration through a clerk.",
    action: "/contact",
    actionLabel: "contact us"
  },
  {
    q: "How do I transfer ownership of land?",
    a: "Ownership transfers are done digitally through a multi-step approval workflow involving seller, buyer, advocate, and registrar.",
    solution: "Initiate a transfer from your dashboard and follow the guided steps.",
    action: "/transfers",
    actionLabel: "Start Transfer"
  },
  {
    q: "Why is my transfer still pending?",
    a: "Transfers require approvals from multiple parties such as advocates, county officers, and the registrar.",
    solution: "Check the transfer status to see which step is pending and follow up with the responsible party.",
    action: "/dashboard",
    actionLabel: "View Dashboard"
  },
  {
    q: "How do I upload documents?",
    a: "Documents are uploaded during transfers or parcel registration and stored securely on IPFS.",
    solution: "Navigate to your active transfer or parcel and upload documents in the documents section.",
    action: "/dashboard",
    actionLabel: "Go to Dashboard"
  },
  {
    q: "What if I suspect fraud or incorrect data?",
    a: "All records are immutable, but suspicious activity can be flagged for investigation.",
    solution: "Report the issue immediately to the registrar or submit a dispute request.",
    action: "/contact",
    actionLabel: "Report Issue"
  },
  {
    q: "How are payments like stamp duty handled?",
    a: "Payments are recorded in the system and linked to your transfer record.",
    solution: "Complete payment through the provided instructions and upload proof if required.",
    action: "/payments",
    actionLabel: "View Payments"
  },
  {
    q: "Can I update parcel boundaries or coordinates?",
    a: "Yes, but only through a licensed surveyor using a mutation process.",
    solution: "Submit a survey request and wait for surveyor approval.",
    action: "/survey",
    actionLabel: "Request Survey"
  },
];

export default function FAQPage() {
      const navigate = useNavigate();   // ✅ add this

  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (i) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "60px 24px" }}>
      
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h1 style={{
          fontFamily: font.head,
          fontSize: 36,
          color: C.navy,
          marginBottom: 12
        }}>
          Frequently Asked Questions
        </h1>
        <p style={{ color: C.textSecondary, maxWidth: 600, margin: "0 auto" }}>
          Find answers to common questions about the Blockchain-Based Land Registry System.
        </p>
      </div>

      {/* FAQ List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {FAQS.map((item, i) => (
          <div key={i} style={{
            border: "1px solid #E2E8F0",
            borderRadius: 10,
            padding: 20,
            cursor: "pointer",
            background: "#fff",
            boxShadow: openIndex === i ? "0 6px 18px rgba(0,0,0,0.08)" : "none",
            transition: "all 0.2s ease"
          }}>
            
            {/* Question */}
            <div
              onClick={() => toggle(i)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <h3 style={{
                fontSize: 16,
                fontWeight: 600,
                color: C.navy,
                fontFamily: font.head
              }}>
                {item.q}
              </h3>
              <span style={{
                fontSize: 20,
                color: C.textSecondary
              }}>
                {openIndex === i ? "−" : "+"}
              </span>
            </div>

            {/* Answer */}
            {openIndex === i && (
              <div style={{ marginTop: 16 }}>
                <p style={{
                  fontSize: 14,
                  color: C.textSecondary,
                  lineHeight: 1.6,
                  marginBottom: 12
                }}>
                  {item.a}
                </p>

                {/* Solution box */}
                <div style={{
                  background: "#F1F5F9",
                  borderLeft: `4px solid ${C.teal}`,
                  padding: "12px 14px",
                  borderRadius: 6,
                  marginBottom: 12
                }}>
                  <strong style={{ color: C.navy }}>What you should do:</strong>
                  <p style={{ marginTop: 4, fontSize: 14, color: C.textSecondary }}>
                    {item.solution}
                  </p>
                </div>

                {/* Action button */}
                {item.action && (
                  <Button
                    size="sm"
                    variant="teal"
                    onClick={() => navigate(item.action)}
                  >
                    {item.actionLabel}
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div style={{
        marginTop: 60,
        textAlign: "center",
        padding: 32,
        background: "#F8FAFC",
        borderRadius: 12
      }}>
        <h3 style={{
          fontFamily: font.head,
          fontSize: 20,
          color: C.navy,
          marginBottom: 10
        }}>
          Still need help?
        </h3>
        <p style={{ color: C.textSecondary, marginBottom: 16 }}>
          Contact support or visit your nearest land registry office.
        </p>
        <Button onClick={() => navigate("/contact")}>
          Contact Support
        </Button>
      </div>
    </div>
  );
}