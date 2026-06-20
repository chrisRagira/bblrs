import api from "./axios";

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login:      (data)       => api.post("/auth/login", data),
  register:   (data)       => api.post("/auth/register", data),
  verifyMfa:  (data)       => api.post("/auth/mfa/verify", data),
  logout:     ()           => api.post("/auth/logout"),
  refresh:    ()           => api.post("/auth/refresh"),
  getProfile: ()           => api.get("/auth/profile"),
  updateProfile: (data)    => api.post("/auth/profile", data),
  forgotPassword: (data) =>
    api.post("/auth/forgot-password", data),

  resetPassword: (token, data) =>
    api.post(`/auth/reset-password/${token}`, data)
};

// ─── Parcels ─────────────────────────────────────────────────────────────────
export const parcelsApi = {
  search:     (params)     => api.get("/parcels/search", { params }),
  getById: (id, params) => api.get(`/parcels/${id}`, { params }),
  getByOwner: (userId) => api.get(`/parcels/owner/${userId}`),
  create:     (data)       => api.post("/parcels", data),
  updateStatus: (id, data) => api.post(`/parcels/${id}/status`, data),
  getHistory: (id)         => api.get(`/parcels/${id}/history`),
  getDocuments: (id)       => api.get(`/parcels/${id}/documents`),
  uploadDocument: (id, formData) =>
    api.post(`/parcels/${id}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  mpesaSearchPay: (data) =>
  api.post("/parcels/mpesa-search-pay", data),
  pollPayStatus: (paymentId) => api.get(`/parcels/mpesa-pay-status/${paymentId}`),
};

// ─── Transfers ───────────────────────────────────────────────────────────────
export const transfersApi = {
  initiate:   (data)       => api.post("/transfers", data),

  getById:    (id)         => api.get(`/transfers/${id}`),
  getByOwner: ()           => api.get(`/transfers`),
  getPending: ()           => api.get("/transfers/pending"),
  getLCB: ()           => api.get("/transfers/lcb"),
  getBySurveyor:(id)       => api.get(`transfers/surveyor/${id}`),
  appointSurveyor: (id, data)  => api.post(`/transfers/${id}/appoint-surveyor`, data),
  initiateMpesa:   (id, data)  => api.post(`/transfers/${id}/stamp-duty/mpesa`, data),
  approve:    (id, data)   => api.post(`/transfers/${id}/approve`, data),
  reject:     (id, data)   => api.post(`/transfers/${id}/reject`, data),
  cancel:     (id)         => api.delete(`/transfers/${id}`),
  getDocs:     (id)        => api.get(`/transfers/${id}/documents`),
downloadDoc: (id, docId) => api.get(`/transfers/${id}/documents/${docId}`, { responseType: "arraybuffer" }),
  
  buyerDecision: (id, data) =>
    api.post(`/transfers/${id}/buyer-decision`, data),
  
  advocateDocs: (id, formData) =>
    api.post(`/transfers/${id}/advocate-docs`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
    
  clerkVerify: (id, data) =>
    api.post(`/transfers/${id}/clerk-verify`, data),
  
  survey: (id, data) =>
    api.post(`/transfers/${id}/survey`, data),
  
  lcbDecision: (id, data) =>
    api.post(`/transfers/${id}/lcb-decision`, data),
  
  countyRates: (id, data) =>
    api.post(`/transfers/${id}/county-rates`, data),
  
  valuation: (id, data) =>
    api.post(`/transfers/${id}/valuation`, data),
  
  stampDuty: (id, formData) =>
    api.post(`/transfers/${id}/stamp-duty`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// ─── Encumbrances ─────────────────────────────────────────────────────────────
export const encumbrancesApi = {
  register:   (data)       => api.post("/encumbrances", data),
  getByParcel: (parcelId)  => api.get(`/encumbrances/${parcelId}`),
  getActive:  (parcelId)   => api.get(`/encumbrances/${parcelId}/active`),
  discharge:  (id, data)   => api.post(`/encumbrances/${id}/discharge`, data),
};

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminApi = {
  getUsers:       (params) => api.get("/admin/users", { params }),
  getUserById:    (id)     => api.get(`/admin/users/${id}`),
  assignRole:     (id, data)     => api.post(`/admin/users/${id}/roles`, data),
  revokeRole:     (id, roleId)   => api.delete(`/admin/users/${id}/roles/${roleId}`),
  deactivateUser: (id)           => api.post(`/admin/users/${id}/deactivate`),
  getAuditLog:    (params)       => api.get("/admin/audit", { params }),
  getReports:    (params)       => api.get("/admin/reports", { params }),
  getReport:      (params)       => api.get("/admin/reports/transactions", { params }),
};

// ─── Document Verification ───────────────────────────────────────────────────
export const verifyApi = {
  verify: (formData) =>
    api.post("/verify", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export const usersApi = {
  getByNationalId: (id) => api.get(`/users/by-national-id/${id}`),
    lookupUser: (nationalId, role) => api.get(`/users/lookup`, { params: { nationalId, role } }),
  getByUserId:     (id) => api.get(`/users/by-user-id/${id}`),
};

export const registrarApi = {
  initiate: (data) => api.post("/registrar/transfers", data),

  getPending: () => api.get("/registrar/transfers/pending"),

  // 🔹 Approve transfer
  approve: (id) => api.post(`/registrar/transfers/${id}/approve`),

  // 🔹 Reject transfer
  reject: (id) => api.post(`/registrar/transfers/${id}/reject`)
};

export const notificationsApi = {
  getByUser: (userId) => api.get(`/notifications/`),
  markRead:  (id)     => api.post(`/notifications/${id}/read`),
};