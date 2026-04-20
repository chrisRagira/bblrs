import api from "./axios";

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login:      (data)       => api.post("/auth/login", data),
  register:   (data)       => api.post("/auth/register", data),
  verifyMfa:  (data)       => api.post("/auth/mfa/verify", data),
  logout:     ()           => api.post("/auth/logout"),
  refresh:    ()           => api.post("/auth/refresh"),
  getProfile: ()           => api.get("/auth/profile"),
  updateProfile: (data)    => api.patch("/auth/profile", data),
  forgotPassword: (data) =>
    api.post("/auth/forgot-password", data),

  resetPassword: (token, data) =>
    api.post(`/auth/reset-password/${token}`, data)
};

// ─── Parcels ─────────────────────────────────────────────────────────────────
export const parcelsApi = {
  search:     (params)     => api.get("/parcels/search", { params }),
  getById:    (id)         => api.get(`/parcels/${id}`),
  getByOwner: (userId) => api.get(`/parcels/owner/${userId}`),
  create:     (data)       => api.post("/parcels", data),
  updateStatus: (id, data) => api.patch(`/parcels/${id}/status`, data),
  getHistory: (id)         => api.get(`/parcels/${id}/history`),
  getDocuments: (id)       => api.get(`/parcels/${id}/documents`),
  uploadDocument: (id, formData) =>
    api.post(`/parcels/${id}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  mpesaSearchPay: (data) =>
  api.post("/mpesa/search-pay", data),
};

// ─── Transfers ───────────────────────────────────────────────────────────────
export const transfersApi = {
  initiate:   (data)       => api.post("/transfers", data),
  getById:    (id)         => api.get(`/transfers/${id}`),
  getByOwner: ()     => api.get(`/transfers`),
  getPending: ()           => api.get("/transfers/pending"),
  approve:    (id)         => api.post(`/transfers/${id}/approve`),
  reject:     (id, data)   => api.post(`/transfers/${id}/reject`, data),
  cancel:     (id)         => api.delete(`/transfers/${id}`),
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
  deactivateUser: (id)           => api.patch(`/admin/users/${id}/deactivate`),
  getAuditLog:    (params)       => api.get("/admin/audit", { params }),
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