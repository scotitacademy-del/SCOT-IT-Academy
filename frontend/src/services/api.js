import axios from "axios";
import dummyData from "../data/dummyData";

/*
 * ======================================================
 * CONFIGURATION
 * ======================================================
 */

const useDummyData =
  String(
    process.env.REACT_APP_USE_BACKEND || ""
  ).trim() !== "true";

const clone = (value) =>
  JSON.parse(JSON.stringify(value));

const nextId = (rows = []) =>
  Math.max(
    ...rows.map(
      (row) => Number(row.id) || 0
    ),
    0
  ) + 1;

const dummyStorageKey =
  "scot_it_dummy_data";

const USERS_KEY =
  "scot_it_users";

const CURRENT_USER_KEY =
  "scot_it_current_user";

const ACCESS_TOKEN_KEY =
  "access_token";

const OWNER_DEFAULT = {
  id: "owner",
  username: "owner",
  password: "scotitacademy@123",
  name: "SCOT IT Academy Owner",
  role: "Owner",
};

/*
 * ======================================================
 * DEFAULT TYPES
 * ======================================================
 *
 * These are used only in Dummy Mode.
 *
 * Backend Mode:
 * The Type Management page/database is the source.
 */

const DEFAULT_TYPES = [
  "Students",
  "Freshers",
  "Experience in Non IT",
  "Experience in IT",
  "Career Gap",
  "Others",
];

/*
 * ======================================================
 * USERS
 * ======================================================
 */

const getStoredUsers = () => {
  try {
    const existing =
      JSON.parse(
        localStorage.getItem(
          USERS_KEY
        ) || "[]"
      );

    return Array.isArray(existing)
      ? existing
      : [];
  } catch {
    return [];
  }
};

const saveStoredUsers = (
  users
) => {
  localStorage.setItem(
    USERS_KEY,
    JSON.stringify(users)
  );
};

export function ensureOwnerAccount() {
  const users =
    getStoredUsers();

  const existing =
    users.find(
      (user) =>
        String(
          user.username || ""
        ).toLowerCase() ===
        String(
          OWNER_DEFAULT.username
        ).toLowerCase()
    );

  if (!existing) {
    users.push({
      ...OWNER_DEFAULT,
    });

    saveStoredUsers(users);
  }

  return users;
}

/*
 * ======================================================
 * CURRENT USER
 * ======================================================
 */

export function getCurrentUser() {
  try {
    const raw =
      localStorage.getItem(
        CURRENT_USER_KEY
      );

    return raw
      ? JSON.parse(raw)
      : null;
  } catch {
    return null;
  }
}

export function getAccessToken() {
  try {
    const token =
      localStorage.getItem(
        ACCESS_TOKEN_KEY
      );

    return token &&
      String(token).trim()
      ? String(token).trim()
      : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(
  user
) {
  if (!user) {
    localStorage.removeItem(
      CURRENT_USER_KEY
    );
    return;
  }

  localStorage.setItem(
    CURRENT_USER_KEY,
    JSON.stringify(user)
  );
}

export function setAuthSession(
  token,
  user
) {
  const sanitizedToken =
    token &&
    String(token).trim()
      ? String(token).trim()
      : null;

  if (sanitizedToken) {
    localStorage.setItem(
      ACCESS_TOKEN_KEY,
      sanitizedToken
    );
  }

  if (user) {
    setCurrentUser(user);
  }
}

export function clearCurrentUser() {
  localStorage.removeItem(
    CURRENT_USER_KEY
  );

  localStorage.removeItem(
    ACCESS_TOKEN_KEY
  );
}

/*
 * ======================================================
 * AUTH TOKEN HELPER
 * ======================================================
 */

function getResponseToken(
  data
) {
  return (
    data?.access ||
    data?.access_token ||
    data?.token ||
    data?.jwt ||
    null
  );
}

/*
 * ======================================================
 * RESET WORKSPACE
 * ======================================================
 */

export function resetWorkspaceForNewAdmin(
  username
) {
  const keys = [
    "scot_it_students",
    "scot_it_enquiries",
    "scot_it_categories",
    "scot_it_referrals",
    "scot_it_dummy_data",
    "scot_it_notifications",
    "scot_it_admins",
    "scot_it_types",
  ];

  keys.forEach((key) =>
    localStorage.removeItem(key)
  );

  localStorage.setItem(
    "scot_it_active_workspace",
    username || "owner"
  );
}

/*
 * ======================================================
 * ADMIN ACCOUNT
 * ======================================================
 */

export function createAdminAccount(
  input = {}
) {
  const users =
    ensureOwnerAccount();

  const username =
    String(
      input.username || ""
    ).trim();

  const password =
    String(
      input.password || ""
    ).trim();

  const name =
    String(
      input.name ||
        username ||
        "Admin"
    ).trim();

  if (!username || !password) {
    throw new Error(
      "Admin username and password are required."
    );
  }

  const duplicate =
    users.find(
      (user) =>
        String(
          user.username || ""
        ).toLowerCase() ===
        username.toLowerCase()
    );

  if (duplicate) {
    throw new Error(
      "This admin username already exists."
    );
  }

  const admin = {
    id: `admin-${Date.now()}`,
    username,
    password,
    name,
    role: "Admin",
  };

  users.push(admin);

  saveStoredUsers(users);

  return admin;
}

/*
 * ======================================================
 * DUMMY DATA STORAGE
 * ======================================================
 */

try {
  const saved =
    JSON.parse(
      localStorage.getItem(
        dummyStorageKey
      ) || "{}"
    );

  Object.assign(
    dummyData,
    saved
  );
} catch {
  // Ignore invalid localStorage
}

const persistDummyData =
  () =>
    localStorage.setItem(
      dummyStorageKey,
      JSON.stringify(dummyData)
    );

/*
 * ======================================================
 * AXIOS
 * ======================================================
 */

const api = axios.create({
  baseURL:
    "https://scot-it-academy-1.onrender.com/api",
  headers: {
    "Content-Type": "application/json",
  },
});

/*
 * ======================================================
 * REQUEST INTERCEPTOR
 * ======================================================
 */

api.interceptors.request.use(
  (config) => {
    const token =
      getAccessToken();

    if (token) {
      config.headers =
        config.headers || {};

      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },

  (error) =>
    Promise.reject(error)
);

/*
 * ======================================================
 * RESPONSE INTERCEPTOR
 * ======================================================
 */

api.interceptors.response.use(
  (response) => response,

  (error) => {
    const status =
      error?.response?.status;

    const requestUrl =
      error?.config?.url || "";

    const isOwnerUpdate =
      requestUrl.includes(
        "/auth/update-owner"
      );

    const isPasswordUpdate =
      requestUrl.includes(
        "/auth/update-password"
      );

    /*
     * Do not automatically logout for
     * owner/password update errors.
     */

    if (
      status === 401 &&
      !isOwnerUpdate &&
      !isPasswordUpdate
    ) {
      clearCurrentUser();

      if (
        typeof window !==
          "undefined" &&
        window.location.pathname !==
          "/login"
      ) {
        window.location.href =
          "/login";
      }
    }

    return Promise.reject(
      error
    );
  }
);

/*
 * ======================================================
 * AUTH API
 * ======================================================
 */

export const authApi = {
  login: async (data = {}) => {
    const username =
      String(
        data?.username || ""
      ).trim();

    const password =
      String(
        data?.password || ""
      );

    if (!username || !password) {
      throw new Error(
        "Username and password are required."
      );
    }

    if (!useDummyData) {
      const response =
        await api.post(
          "/auth/login",
          {
            username,
            password,
          }
        );

      const user =
        response.data?.user || null;

      const token =
        getResponseToken(
          response.data
        );

      if (!user) {
        throw new Error(
          "User information was not returned by the server."
        );
      }

      if (!token) {
        throw new Error(
          "Login token was not returned by the server."
        );
      }

      setAuthSession(
        token,
        user
      );

      if (
        String(
          user.role || ""
        ).toLowerCase() === "admin"
      ) {
        resetWorkspaceForNewAdmin(
          user.username
        );
      }

      return response;
    }

    /*
     * Dummy mode
     */

    ensureOwnerAccount();

    const users =
      getStoredUsers();

    const matchedUser =
      users.find(
        (user) =>
          String(
            user.username || ""
          ).toLowerCase() ===
            username.toLowerCase() &&
          String(
            user.password || ""
          ) === password
      );

    if (matchedUser) {
      const payloadUser = {
        id:
          matchedUser.id ||
          matchedUser.username,

        username:
          matchedUser.username,

        name:
          matchedUser.name ||
          matchedUser.username,

        role:
          matchedUser.role ||
          "Admin",
      };

      setAuthSession(
        "demo-token",
        payloadUser
      );

      return {
        data: {
          access:
            "demo-token",

          user:
            payloadUser,
        },
      };
    }

    throw new Error(
      "Invalid username or password."
    );
  },

  signup: async (data = {}) => {
    if (!useDummyData) {
      const response =
        await api.post(
          "/auth/signup",
          data
        );

      const user =
        response.data?.user || null;

      const token =
        getResponseToken(
          response.data
        );

      if (!user) {
        throw new Error(
          "Signup succeeded but user information was not returned."
        );
      }

      if (token) {
        setAuthSession(
          token,
          user
        );
      } else {
        setCurrentUser(user);
      }

      return response;
    }

    throw new Error(
      "Dummy signup implementation goes here."
    );
  },

  updateOwner: async (
    data = {}
  ) => {
    const username =
      String(
        data?.username || ""
      ).trim();

    const currentPassword =
      String(
        data?.current_password || ""
      );

    if (!username) {
      throw new Error(
        "Please enter owner username."
      );
    }

    if (!currentPassword) {
      throw new Error(
        "Please enter your current password."
      );
    }

    if (!getAccessToken()) {
      throw new Error(
        "Authentication token is missing. Please login again."
      );
    }

    const response =
      await api.put(
        "/auth/update-owner",
        {
          username,
          current_password:
            currentPassword,
        }
      );

    const user =
      response.data?.user || null;

    const newToken =
      getResponseToken(
        response.data
      );

    if (newToken) {
      setAuthSession(
        newToken,
        user ||
          getCurrentUser()
      );
    } else if (user) {
      setCurrentUser(user);
    }

    return response;
  },

  updatePassword: async (
    data = {}
  ) => {
    const currentPassword =
      String(
        data?.current_password || ""
      );

    const newPassword =
      String(
        data?.new_password || ""
      );

    if (!currentPassword) {
      throw new Error(
        "Please enter current password."
      );
    }

    if (!newPassword) {
      throw new Error(
        "Please enter new password."
      );
    }

    if (
      newPassword.length < 6
    ) {
      throw new Error(
        "New password must contain at least 6 characters."
      );
    }

    if (!getAccessToken()) {
      throw new Error(
        "Authentication token is missing. Please login again."
      );
    }

    const response =
      await api.put(
        "/auth/update-password",
        {
          current_password:
            currentPassword,

          new_password:
            newPassword,
        }
      );

    const user =
      response.data?.user || null;

    const newToken =
      getResponseToken(
        response.data
      );

    if (newToken) {
      setAuthSession(
        newToken,
        user ||
          getCurrentUser()
      );
    } else if (user) {
      setCurrentUser(user);
    }

    return response;
  },

  me: () =>
    api.get(
      "/auth/me"
    ),
};

/*
 * ======================================================
 * DASHBOARD API
 * ======================================================
 */

export const dashboardApi = {
  summary: () => {
    if (!useDummyData) {
      return api.get(
        "/dashboard/"
      );
    }

    return Promise.resolve({
      data: {
        recent:
          clone(
            dummyData.enquiries
          ).map((row) => [
            row.admin,
            row.candidate_name,
            row.mobile,
            row.city,
            row.category,
            row.course,
            row.next_followup_date,
            row.status,
          ]),

        follow:
          clone(
            dummyData.enquiries
          ).map((row) => ({
            ...row,
            name:
              row.candidate_name,
          })),

        categories:
          dummyData.categories.map(
            (category) => [
              category,

              dummyData.enquiries.filter(
                (row) =>
                  row.category ===
                    category &&
                  row.status ===
                    "Joined"
              ).length,

              0,
            ]
          ),
      },
    });
  },

  notifications: () => {
    if (!useDummyData) {
      return api.get(
        "/notifications/"
      );
    }

    return Promise.resolve({
      data:
        clone(
          dummyData.notifications
        ).map((row) => ({
          ...row,
          name:
            row.student_name,
        })),
    });
  },
};

/*
 * ======================================================
 * ENQUIRY API
 * ======================================================
 */

export const enquiryApi = {
  list: (params) =>
    useDummyData
      ? Promise.resolve({
          data: clone(
            dummyData.enquiries
          ),
        })
      : api.get(
          "/enquiries/",
          { params }
        ),

  create: (data) => {
    if (!useDummyData) {
      return api.post(
        "/enquiries/",
        data
      );
    }

    const row = {
      ...data,
      id: nextId(
        dummyData.enquiries
      ),
    };

    dummyData.enquiries.push(
      row
    );

    persistDummyData();

    return Promise.resolve({
      data: clone(row),
    });
  },

  detail: (id) => {
    if (!useDummyData) {
      return api.get(
        `/enquiries/${id}/`
      );
    }

    return Promise.resolve({
      data: clone(
        dummyData.enquiries.find(
          (row) =>
            String(row.id) ===
            String(id)
        ) || {}
      ),
    });
  },

  update: (
    id,
    data
  ) => {
    if (!useDummyData) {
      return api.patch(
        `/enquiries/${id}/`,
        data
      );
    }

    const row =
      dummyData.enquiries.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (row) {
      Object.assign(
        row,
        data
      );
    }

    persistDummyData();

    return Promise.resolve({
      data: clone(
        row || data
      ),
    });
  },

  remove: (id) => {
    if (!useDummyData) {
      return api.delete(
        `/enquiries/${id}/`
      );
    }

    dummyData.enquiries =
      dummyData.enquiries.filter(
        (row) =>
          String(row.id) !==
          String(id)
      );

    persistDummyData();

    return Promise.resolve({
      data: {
        deleted: true,
      },
    });
  },
};

/*
 * ======================================================
 * STUDENT API
 * ======================================================
 */

export const studentApi = {
  // ====================================================
  // LIST STUDENTS
  // ====================================================

  list: (params = {}) => {
    if (!useDummyData) {
      return api.get("/students/", {
        params,
      });
    }

    return Promise.resolve({
      data: clone(dummyData.students),
    });
  },

  // ====================================================
  // SESSION STUDENTS
  // ====================================================
  // Uses the existing /students/ API.
  //
  // Example:
  // /api/students/?year=2026&month=9
  //
  // The React page also filters joinDate locally,
  // so this continues working even if the backend
  // does not yet process year/month parameters.
  // ====================================================

  session: (year, month) => {
    const selectedYear = Number(year);
    const selectedMonth = Number(month);

    if (
      !selectedYear ||
      !selectedMonth ||
      selectedMonth < 1 ||
      selectedMonth > 12
    ) {
      return Promise.reject(
        new Error("Valid year and month are required.")
      );
    }

    if (!useDummyData) {
      return api.get("/students/", {
        params: {
          year: selectedYear,
          month: selectedMonth,
        },
      });
    }

    const students = clone(
      dummyData.students || []
    );

    return Promise.resolve({
      data: students,
    });
  },

  // ====================================================
  // STUDENT DETAIL
  // ====================================================

  detail: (id) => {
    if (!useDummyData) {
      return api.get(`/students/${id}/`);
    }

    const student = dummyData.students.find(
      (row) =>
        String(row.id) === String(id)
    );

    return Promise.resolve({
      data: clone(student || {}),
    });
  },

  // ====================================================
  // CREATE STUDENT
  // ====================================================

  create: async (data) => {
    if (!useDummyData) {
      const payload = {
        ...data,

        status: data.status || "Active",

        paidFee:
          Number(data?.paidFee) || 0,

        balanceFee:
          Number(data?.balanceFee) || 0,

        totalFee:
          Number(data?.totalFee) ||
          (Number(data?.paidFee) || 0) +
            (Number(data?.balanceFee) || 0),
      };

      return api.post(
        "/students/",
        payload
      );
    }

    const paidFee =
      Number(data?.paidFee) || 0;

    const balanceFee =
      Number(data?.balanceFee) || 0;

    const totalFee =
      Number(data?.totalFee) ||
      paidFee + balanceFee;

    const student = {
      ...data,

      id: nextId(
        dummyData.students
      ),

      status: "Joined",

      paidFee,
      balanceFee,
      totalFee,
    };

    dummyData.students.push(student);

    persistDummyData();

    return Promise.resolve({
      data: clone(student),
    });
  },

  // ====================================================
  // UPDATE STUDENT
  // ====================================================

  update: async (id, data) => {
    if (!useDummyData) {
      const payload = {
        ...data,

        status: data.status || "Active",

        paidFee:
          Number(data?.paidFee) || 0,

        balanceFee:
          Number(data?.balanceFee) || 0,

        totalFee:
          Number(data?.totalFee) ||
          (Number(data?.paidFee) || 0) +
            (Number(data?.balanceFee) || 0),
      };

      return api.patch(
        `/students/${id}/`,
        payload
      );
    }

    const index =
      dummyData.students.findIndex(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (index === -1) {
      return Promise.reject(
        new Error("Student not found.")
      );
    }

    const oldStudent =
      dummyData.students[index];

    const paidFee =
      Number(data?.paidFee) || 0;

    const balanceFee =
      Number(data?.balanceFee) || 0;

    const totalFee =
      Number(data?.totalFee) ||
      paidFee + balanceFee;

    const updatedStudent = {
      ...oldStudent,
      ...data,

      id: oldStudent.id,

      status: "Joined",

      paidFee,
      balanceFee,
      totalFee,
    };

    dummyData.students[index] =
      updatedStudent;

    persistDummyData();

    return Promise.resolve({
      data: clone(updatedStudent),
    });
  },

  // ====================================================
  // DELETE STUDENT
  // ====================================================

  delete: (id) => {
    if (!useDummyData) {
      return api.delete(
        `/students/${id}/`
      );
    }

    dummyData.students =
      dummyData.students.filter(
        (row) =>
          String(row.id) !==
          String(id)
      );

    persistDummyData();

    return Promise.resolve({
      data: {
        deleted: true,
      },
    });
  },

  // ====================================================
  // NEXT STUDENT ID
  // ====================================================
  // Returns the next available Student ID (e.g. SCT001)
  // ====================================================

  nextId: () => {
    if (!useDummyData) {
      return api.get("/students/next-id/");
    }

    // Dummy mode: calculate from local students
    const students = dummyData.students || [];
    let maxNum = 0;
    students.forEach((s) => {
      const sid = String(s.studentId || s.student_id || s.id || "");
      const match = sid.match(/^SCT(\d+)$/i);
      if (match) {
        maxNum = Math.max(maxNum, parseInt(match[1], 10));
      }
    });
    const nextNum = maxNum + 1;
    const nextStudentId = `SCT${String(nextNum).padStart(3, "0")}`;
    return Promise.resolve({ data: { nextId: nextStudentId } });
  },
};

/*
 * ======================================================
 * LOCAL ENQUIRY
 * ======================================================
 */

const localEnquiryKey =
  "scot_it_enquiries";

export function getLocalEnquiries() {
  try {
    const rows =
      JSON.parse(
        localStorage.getItem(
          localEnquiryKey
        ) || "[]"
      );

    return rows.map(
      (row, index) =>
        row.id
          ?.toString()
          .startsWith("local-")
          ? {
              ...row,

              record_id:
                row.id,

              id: `ST-${String(
                index + 1
              ).padStart(3, "0")}`,
            }
          : row
    );
  } catch {
    return [];
  }
}

export function saveLocalEnquiry(
  enquiry
) {
  const rows =
    getLocalEnquiries();

  const next = {
    ...enquiry,

    id:
      enquiry.id ||
      `ST-${String(
        rows.length + 1
      ).padStart(3, "0")}`,
  };

  localStorage.setItem(
    localEnquiryKey,
    JSON.stringify([
      ...rows.filter(
        (row) =>
          row.id !== next.id
      ),
      next,
    ])
  );

  return next;
}

export function removeLocalEnquiry(
  id
) {
  const rows =
    getLocalEnquiries().filter(
      (row) =>
        row.id !== id &&
        row.record_id !== id
    );

  localStorage.setItem(
    localEnquiryKey,
    JSON.stringify(rows)
  );
}

/*
 * ======================================================
 * CATEGORY API
 * ======================================================
 */

export function getLocalCategories() {
  try {
    return JSON.parse(
      localStorage.getItem(
        "scot_it_categories"
      ) || "[]"
    );
  } catch {
    return [];
  }
}

export function saveLocalCategory(
  name
) {
  const categories =
    getLocalCategories();

  if (
    !categories.includes(
      name
    )
  ) {
    localStorage.setItem(
      "scot_it_categories",
      JSON.stringify([
        ...categories,
        name,
      ])
    );
  }
}

export function renameLocalCategory(
  previous,
  next
) {
  const categories =
    getLocalCategories().map(
      (name) =>
        name === previous
          ? next
          : name
    );

  localStorage.setItem(
    "scot_it_categories",
    JSON.stringify([
      ...new Set(categories),
    ])
  );
}

export function removeLocalCategory(
  name
) {
  localStorage.setItem(
    "scot_it_categories",
    JSON.stringify(
      getLocalCategories().filter(
        (item) =>
          item !== name
      )
    )
  );
}

export const categoryApi = {
  list: () => {
    if (!useDummyData) {
      return api.get(
        "/categories/"
      );
    }

    return Promise.resolve({
      data: clone(
        dummyData.categories
      ).map((name) => ({
        id: name,
        name,
      })),
    });
  },

  create: (data) => {
    if (!useDummyData) {
      return api.post(
        "/categories/",
        data
      );
    }

    if (
      !dummyData.categories.includes(
        data.name
      )
    ) {
      dummyData.categories.push(
        data.name
      );
    }

    persistDummyData();

    return Promise.resolve({
      data: {
        id: data.name,
        ...data,
      },
    });
  },

  update: (
    id,
    data
  ) => {
    if (!useDummyData) {
      return api.patch(
        `/categories/${id}/`,
        data
      );
    }

    const index =
      dummyData.categories.findIndex(
        (name) =>
          name === id
      );

    if (index >= 0) {
      dummyData.categories[
        index
      ] = data.name;
    }

    persistDummyData();

    return Promise.resolve({
      data: {
        id: data.name,
        ...data,
      },
    });
  },

  remove: (id) => {
    if (!useDummyData) {
      return api.delete(
        `/categories/${id}/`
      );
    }

    dummyData.categories =
      dummyData.categories.filter(
        (name) =>
          name !== id
      );

    persistDummyData();

    return Promise.resolve({
      data: {
        deleted: true,
      },
    });
  },
};

/*
 * ======================================================
 * TYPE API
 * ======================================================
 *
 * IMPORTANT:
 *
 * Backend endpoints expected:
 *
 * GET    /api/types/
 * POST   /api/types/
 * PATCH  /api/types/<id>/
 * DELETE /api/types/<id>/
 *
 * Backend response expected:
 *
 * [
 *   {
 *     "id": 1,
 *     "name": "Experience"
 *   }
 * ]
 *
 * OR:
 *
 * {
 *   "results": [
 *     {
 *       "id": 1,
 *       "name": "Experience"
 *     }
 *   ]
 * }
 *
 */



const getLocalTypes = () => {
  try {
    const saved =
      JSON.parse(
        localStorage.getItem(
          "scot_it_types"
        ) || "null"
      );

    if (
      Array.isArray(saved) &&
      saved.length > 0
    ) {
      return saved;
    }

    const initialTypes =
      DEFAULT_TYPES.map(
        (name, index) => ({
          id: index + 1,
          name,
        })
      );

    localStorage.setItem(
      "scot_it_types",
      JSON.stringify(
        initialTypes
      )
    );

    return initialTypes;
  } catch {
    return DEFAULT_TYPES.map(
      (name, index) => ({
        id: index + 1,
        name,
      })
    );
  }
};

const saveLocalTypes = (
  types
) => {
  localStorage.setItem(
    "scot_it_types",
    JSON.stringify(types)
  );
};

export const typeApi = {
  /*
   * Get all types
   */
  list: async () => {
    if (!useDummyData) {
      const response =
        await api.get(
          "/types/"
        );

      /*
       * Supports both:
       *
       * [
       *   {...}
       * ]
       *
       * and:
       *
       * {
       *   results: [...]
       * }
       */

      const data =
        Array.isArray(
          response.data
        )
          ? response.data
          : Array.isArray(
              response.data?.results
            )
          ? response.data.results
          : [];

      return {
        ...response,
        data,
      };
    }

    return Promise.resolve({
      data: clone(
        getLocalTypes()
      ),
    });
  },

  /*
   * Create new type
   */
  create: async (
    data = {}
  ) => {
    const name =
      String(
        data?.name || ""
      ).trim();

    if (!name) {
      throw new Error(
        "Type name is required."
      );
    }

    if (!useDummyData) {
      return api.post(
        "/types/",
        {
          name,
        }
      );
    }

    const types =
      getLocalTypes();

    const exists =
      types.some(
        (item) =>
          String(
            item.name || ""
          )
            .trim()
            .toLowerCase() ===
          name.toLowerCase()
      );

    if (exists) {
      throw new Error(
        "This type already exists."
      );
    }

    const newType = {
      id: nextId(types),
      name,
    };

    types.push(newType);

    saveLocalTypes(types);

    return Promise.resolve({
      data: clone(newType),
    });
  },

  /*
   * Update existing type
   */
  update: async (
    id,
    data = {}
  ) => {
    const name =
      String(
        data?.name || ""
      ).trim();

    if (!name) {
      throw new Error(
        "Type name is required."
      );
    }

    if (!useDummyData) {
      return api.patch(
        `/types/${id}/`,
        {
          name,
        }
      );
    }

    const types =
      getLocalTypes();

    const index =
      types.findIndex(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (index === -1) {
      throw new Error(
        "Type not found."
      );
    }

    const duplicate =
      types.some(
        (item, itemIndex) =>
          itemIndex !== index &&
          String(
            item.name || ""
          )
            .trim()
            .toLowerCase() ===
            name.toLowerCase()
      );

    if (duplicate) {
      throw new Error(
        "This type already exists."
      );
    }

    types[index] = {
      ...types[index],
      name,
    };

    saveLocalTypes(types);

    return Promise.resolve({
      data: clone(
        types[index]
      ),
    });
  },

  /*
   * Delete type
   */
  remove: async (
    id
  ) => {
    if (!useDummyData) {
      return api.delete(
        `/types/${id}/`
      );
    }

    const types =
      getLocalTypes();

    const updated =
      types.filter(
        (item) =>
          String(item.id) !==
          String(id)
      );

    saveLocalTypes(updated);

    return Promise.resolve({
      data: {
        deleted: true,
      },
    });
  },
};

/*
 * ======================================================
 * FOLLOW UP API
 * ======================================================
 */

export const followUpApi = {
  list: (params) =>
    useDummyData
      ? Promise.resolve({
          data: clone(
            dummyData.enquiries
          ),
        })
      : api.get(
          "/follow-ups/",
          { params }
        ),
};

/*
 * ======================================================
 * REPORT API
 * ======================================================
 */

export const reportApi = {
  summary: (params) =>
    api.get(
      "/reports/",
      { params }
    ),
};

/*
 * ======================================================
 * ADMIN API
 * ======================================================
 */

export const adminApi = {
  list: () => {
    if (!useDummyData) {
      return api.get(
        "/admins/"
      );
    }

    const users =
      ensureOwnerAccount();

    const admins =
      users.filter(
        (user) =>
          String(
            user.role || ""
          ).toLowerCase() ===
          "admin"
      );

    return Promise.resolve({
      data: clone(
        admins.map(
          (user) => ({
            id:
              user.id ||
              user.username,

            name:
              user.name ||
              user.username,

            username:
              user.username,

            password:
              user.password,

            role:
              "Administrator",

            status:
              "Active",
          })
        )
      ),
    });
  },

  create: (data) => {
    if (!useDummyData) {
      return api.post(
        "/admins/",
        data
      );
    }

    const users =
      getStoredUsers();

    const username =
      String(
        data?.username || ""
      ).trim();

    const password =
      String(
        data?.password || ""
      ).trim();

    const name =
      String(
        data?.name ||
          username ||
          "Admin"
      ).trim();

    if (!username || !password) {
      return Promise.reject(
        new Error(
          "Admin username and password are required."
        )
      );
    }

    const duplicate =
      users.find(
        (user) =>
          String(
            user.username || ""
          ).toLowerCase() ===
          username.toLowerCase()
      );

    if (duplicate) {
      return Promise.reject(
        new Error(
          "This admin username already exists."
        )
      );
    }

    const record = {
      id:
        `admin-${Date.now()}`,

      username,

      password,

      name,

      role: "Admin",
    };

    users.push(record);

    saveStoredUsers(users);

    return Promise.resolve({
      data: {
        ...record,
        role:
          "Administrator",
        status:
          "Active",
      },
    });
  },

  update: (
    id,
    data
  ) => {
    if (!useDummyData) {
      return api.patch(
        `/admins/${id}/`,
        data
      );
    }

    const users =
      getStoredUsers();

    const index =
      users.findIndex(
        (user) =>
          String(
            user.id ||
              user.username
          ) ===
            String(id) &&
          String(
            user.role || ""
          ).toLowerCase() ===
            "admin"
      );

    if (index === -1) {
      return Promise.reject(
        new Error(
          "Admin record not found."
        )
      );
    }

    const username =
      String(
        data?.username || ""
      ).trim();

    const password =
      String(
        data?.password || ""
      ).trim();

    const name =
      String(
        data?.name ||
          username ||
          users[index].name ||
          "Admin"
      ).trim();

    if (!username || !password) {
      return Promise.reject(
        new Error(
          "Admin username and password are required."
        )
      );
    }

    users[index] = {
      ...users[index],
      username,
      password,
      name,
    };

    saveStoredUsers(users);

    return Promise.resolve({
      data: {
        ...users[index],
        role:
          "Administrator",
        status:
          "Active",
      },
    });
  },

  remove: (id) => {
    if (!useDummyData) {
      return api.delete(
        `/admins/${id}/`
      );
    }

    const users =
      getStoredUsers();

    const nextUsers =
      users.filter(
        (user) =>
          !(
            String(
              user.id ||
                user.username
            ) ===
              String(id) &&
            String(
              user.role || ""
            ).toLowerCase() ===
              "admin"
          )
      );

    if (
      nextUsers.length ===
      users.length
    ) {
      return Promise.reject(
        new Error(
          "Admin record not found."
        )
      );
    }

    saveStoredUsers(
      nextUsers
    );

    return Promise.resolve({
      data: {
        deleted: true,
      },
    });
  },
};

/*
 * ======================================================
 * REFERRAL API
 * ======================================================
 */

export const referralApi = {
  list: () => {
    if (useDummyData) {
      try {
        const rows =
          JSON.parse(
            localStorage.getItem(
              "scot_it_referrals"
            ) || "[]"
          );

        return Promise.resolve({
          data: clone(rows),
        });
      } catch {
        return Promise.resolve({
          data: [],
        });
      }
    }

    return api.get(
      "/referrals/"
    );
  },

  create: (data) => {
    if (useDummyData) {
      const rows =
        JSON.parse(
          localStorage.getItem(
            "scot_it_referrals"
          ) || "[]"
        );

      const payload = {
        id: nextId(rows),
        ...data,
      };

      localStorage.setItem(
        "scot_it_referrals",
        JSON.stringify([
          ...rows,
          payload,
        ])
      );

      return Promise.resolve({
        data: clone(payload),
      });
    }

    return api.post(
      "/referrals/",
      data
    );
  },

  update: (
    id,
    data
  ) => {
    if (useDummyData) {
      const rows =
        JSON.parse(
          localStorage.getItem(
            "scot_it_referrals"
          ) || "[]"
        );

      const index =
        rows.findIndex(
          (item) =>
            String(item.id) ===
            String(id)
        );

      if (index >= 0) {
        rows[index] = {
          ...rows[index],
          ...data,
        };

        localStorage.setItem(
          "scot_it_referrals",
          JSON.stringify(rows)
        );

        return Promise.resolve({
          data: clone(
            rows[index]
          ),
        });
      }

      const payload = {
        id,
        ...data,
      };

      localStorage.setItem(
        "scot_it_referrals",
        JSON.stringify([
          ...rows,
          payload,
        ])
      );

      return Promise.resolve({
        data: clone(payload),
      });
    }

    return api.patch(
      `/referrals/${id}/`,
      data
    );
  },

  remove: (id) => {
    if (useDummyData) {
      const rows =
        JSON.parse(
          localStorage.getItem(
            "scot_it_referrals"
          ) || "[]"
        );

      const updated =
        rows.filter(
          (item) =>
            String(item.id) !==
            String(id)
        );

      localStorage.setItem(
        "scot_it_referrals",
        JSON.stringify(updated)
      );

      return Promise.resolve({
        data: {
          deleted: true,
        },
      });
    }

    return api.delete(
      `/referrals/${id}/`
    );
  },
};

/*
 * ======================================================
 * SETTINGS API
 * ======================================================
 */

export const settingsApi = {
  get: () =>
    api.get(
      "/settings/"
    ),

  update: (data) =>
    api.patch(
      "/settings/",
      data
    ),
};

/*
 * ======================================================
 * EXPORT AXIOS INSTANCE
 * ======================================================
 */

export default api;