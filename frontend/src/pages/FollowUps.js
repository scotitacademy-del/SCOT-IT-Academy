import React, { useEffect, useState } from "react";
import { enquiryApi } from "../services/api";
import {
  Panel,
  Stats,
  Badge,
  Pagination,
} from "../components/Ui";

// ======================================================
// DATE HELPER
// ======================================================

// Converts:
// 2026-09-04
// 2026-09-04T18:30:00.000Z
// 2026-09-04 18:30:00
// into:
// 2026-09-04

function formatDateForInput(value) {
  if (!value) return "";

  const stringValue = String(value).trim();

  // Already YYYY-MM-DD
  const match = stringValue.match(
    /^(\d{4}-\d{2}-\d{2})/
  );

  if (match) {
    return match[1];
  }

  return "";
}

// ======================================================
// DISPLAY DATE
// ======================================================

function formatDateForDisplay(value) {
  const dateValue =
    formatDateForInput(value);

  if (!dateValue) return "-";

  const [
    year,
    month,
    day,
  ] = dateValue.split("-");

  return `${day}-${month}-${year}`;
}

// ======================================================
// CHECK COMPLETED STATUS
// ======================================================

function isCompletedStatus(status) {
  const normalizedStatus = String(
    status || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  return [
    "completed",
    "complete",
    "complate",
    "complated",
  ].includes(normalizedStatus);
}

// ======================================================
// CHECK EXCLUDED STATUS
// ======================================================

function isExcludedStatus(status) {
  const normalizedStatus = String(
    status || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  return (
    normalizedStatus === "joined" ||
    normalizedStatus === "negative" ||
    isCompletedStatus(status)
  );
}

// ======================================================
// NORMALIZE API DATA
// ======================================================

function normalize(item) {
  const followUpDate =
    item.next_followup_date ||
    item.followup_date ||
    item.followUpDate ||
    item.date ||
    "";

  return {
    ...item,

    id: item.id,

    candidate:
      item.candidate ||
      item.name ||
      item.candidate_name ||
      "",

    course:
      item.course ||
      item.type ||
      "",

    mobile:
      item.mobile ||
      item.mobile_no ||
      item.phone ||
      "",

    discussion:
      item.discussion ||
      item.comments ||
      item.last_discussion ||
      "No discussion recorded",

    // IMPORTANT:
    // Always convert API date into YYYY-MM-DD
    date: formatDateForInput(
      followUpDate
    ),

    status: String(
      item.status ||
      item.final_status ||
      item.finalStatus ||
      item.student_status ||
      "Pending"
    ).trim(),
  };
}

// ======================================================
// COMPONENT
// ======================================================

export default function FollowUps() {
  const [rows, setRows] = useState([]);

  const [page, setPage] =
    useState(1);

  const [selected, setSelected] =
    useState(null);

  const [editForm, setEditForm] =
    useState({
      date: "",
      discussion: "",
    });

  // ====================================================
  // TODAY
  // ====================================================

  const today = (() => {
    const date = new Date();

    const year =
      date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  })();

  // ====================================================
  // LOAD ENQUIRIES
  // ====================================================

  useEffect(() => {
    loadFollowUps();
  }, []);

  async function loadFollowUps() {
    try {
      const response =
        await enquiryApi.list();

      const data =
        response?.data?.results ||
        response?.data ||
        [];

      const normalizedData =
        Array.isArray(data)
          ? data.map(normalize)
          : [];

      setRows(normalizedData);
    } catch (error) {
      console.error(
        "Failed to load follow-ups:",
        error
      );

      setRows([]);
    }
  }

  // ====================================================
  // OPEN FOLLOW-UP MODAL
  // ====================================================

  function openFollowUp(row) {
    const normalizedRow =
      normalize(row);

    setSelected(
      normalizedRow
    );

    setEditForm({
      // Date input receives ONLY YYYY-MM-DD
      date: formatDateForInput(
        normalizedRow.date
      ),

      discussion:
        normalizedRow.discussion ||
        "No discussion recorded",
    });
  }

  // ====================================================
  // CLOSE MODAL
  // ====================================================

  function closeModal() {
    setSelected(null);

    setEditForm({
      date: "",
      discussion: "",
    });
  }

  // ====================================================
  // HANDLE FORM CHANGE
  // ====================================================

  function handleChange(event) {
    const {
      name,
      value,
    } = event.target;

    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  // ====================================================
  // SAVE FOLLOW-UP
  // ====================================================

  async function updateFollowUp(event) {
    event.preventDefault();

    if (!selected) return;

    const followUpDate =
      formatDateForInput(
        editForm.date
      );

    const discussion =
      editForm.discussion.trim() ||
      "No discussion recorded";

    // ==================================================
    // UPDATE LOCAL ROW
    // ==================================================

    const updatedRow =
      normalize({
        ...selected,

        date: followUpDate,

        next_followup_date:
          followUpDate,

        followup_date:
          followUpDate,

        comments: discussion,

        last_discussion:
          discussion,

        discussion: discussion,
      });

    setRows((prevRows) =>
      prevRows.map((row) => {
        if (
          selected.id &&
          row.id === selected.id
        ) {
          return updatedRow;
        }

        return row;
      })
    );

    // ==================================================
    // UPDATE BACKEND
    // ==================================================

    if (selected.id) {
      try {
        await enquiryApi.update(
          selected.id,
          {
            ...selected,

            candidate_name:
              selected.candidate ||
              selected.name ||
              selected.candidate_name ||
              "",

            name:
              selected.candidate ||
              selected.name ||
              selected.candidate_name ||
              "",

            next_followup_date:
              followUpDate,

            followup_date:
              followUpDate,

            comments:
              discussion,

            last_discussion:
              discussion,
          }
        );

        console.log(
          "Follow-up updated successfully"
        );
      } catch (error) {
        console.error(
          "Failed to update follow-up:",
          error
        );
      }
    }

    // ==================================================
    // UPDATE SELECTED DATA
    // ==================================================

    setSelected(
      updatedRow
    );

    setEditForm({
      date: followUpDate,
      discussion,
    });
  }

  // ======================================================
  // FILTER ACTIVE FOLLOW-UPS
  // ======================================================
  //
  // IMPORTANT:
  // Completed, Complete, Complate and Complated
  // are removed from follow-up cards and table.
  //
  // Joined and Negative are also excluded.
  // ======================================================

  const activeRows =
    rows.filter((row) => {
      const status =
        String(
          row.status || ""
        ).trim();

      // Do not show completed rows
      if (
        isCompletedStatus(status)
      ) {
        return false;
      }

      // Do not show Joined / Negative
      if (
        isExcludedStatus(status)
      ) {
        return false;
      }

      // Follow-up date must exist
      if (
        !formatDateForInput(
          row.date
        )
      ) {
        return false;
      }

      return true;
    });

  // ======================================================
  // RESET PAGE WHEN FILTERED DATA CHANGES
  // ======================================================

  useEffect(() => {
    const totalPages =
      Math.max(
        1,
        Math.ceil(
          activeRows.length / 10
        )
      );

    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [
    activeRows.length,
    page,
  ]);

  // ======================================================
  // TODAY
  // ======================================================

  const todayRows =
    activeRows.filter((row) => {
      return (
        formatDateForInput(
          row.date
        ) === today
      );
    });

  // ======================================================
  // OVERDUE
  // ======================================================

  const overdueRows =
    activeRows.filter((row) => {
      const date =
        formatDateForInput(
          row.date
        );

      return (
        date &&
        date < today
      );
    });

  // ======================================================
  // UPCOMING
  // ======================================================

  const upcomingRows =
    activeRows.filter((row) => {
      const date =
        formatDateForInput(
          row.date
        );

      return (
        date &&
        date > today
      );
    });

  // ======================================================
  // PAGINATION
  // ======================================================

  const visibleRows =
    activeRows.slice(
      (page - 1) * 10,
      page * 10
    );

  // ======================================================
  // UI
  // ======================================================

  return (
    <>
      {/* ==================================================
          STATS
      ================================================== */}

      <Stats
        items={[
          {
            icon: "◷",
            color: "orange",
            label:
              "Today's Follow-ups",
            value:
              todayRows.length,
          },

          {
            icon: "!",
            color: "red",
            label: "Overdue",
            value:
              overdueRows.length,
          },

          {
            icon: "→",
            color: "blue",
            label: "Upcoming",
            value:
              upcomingRows.length,
          },
        ]}
      />

      {/* ==================================================
          FOLLOW-UP TABLE
      ================================================== */}

      <Panel
        title="Follow-up Schedule"
        subtitle="Current follow-up data"
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Candidate",
                  "Course",
                  "Last Discussion",
                  "Date",
                  "Status",
                  "Action",
                ].map((header) => (
                  <th key={header}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {visibleRows.map(
                (row, index) => (
                  <tr
                    key={
                      row.id ||
                      `${row.candidate}-${row.date}-${index}`
                    }
                  >
                    {/* Candidate */}

                    <td>
                      {row.candidate ||
                        "-"}
                    </td>

                    {/* Course */}

                    <td>
                      {row.course ||
                        "-"}
                    </td>

                    {/* Discussion */}

                    <td>
                      {row.discussion ||
                        "No discussion recorded"}
                    </td>

                    {/* Date */}

                    <td>
                      {formatDateForDisplay(
                        row.date
                      )}
                    </td>

                    {/* Status */}

                    <td>
                      <Badge
                        status={
                          row.status
                        }
                      />
                    </td>

                    {/* Action */}

                    <td>
                      <button
                        type="button"
                        className="primary small"
                        onClick={() =>
                          openFollowUp(
                            row
                          )
                        }
                      >
                        Follow-up
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        {activeRows.length ===
          0 && (
          <div className="empty">
            No current follow-ups.
          </div>
        )}

        <Pagination
          page={page}
          setPage={setPage}
          total={
            activeRows.length
          }
        />
      </Panel>

      {/* ==================================================
          FOLLOW-UP MODAL
      ================================================== */}

      {selected && (
        <div
          className="modal-backdrop"
          onClick={closeModal}
        >
          <form
            className="modal edit-modal"
            onSubmit={
              updateFollowUp
            }
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            {/* ==================================================
                MODAL HEADER
            ================================================== */}

            <div className="modal-header">
              <div>
                <h3>
                  {selected.candidate ||
                    "Student"}
                </h3>

                <p>
                  Previous follow-up
                  details
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  closeModal
                }
              >
                ×
              </button>
            </div>

            {/* ==================================================
                FORM
            ================================================== */}

            <div
              className="form-grid"
              style={{
                marginTop: "16px",
              }}
            >
              {/* Student Name */}

              <div className="form-group">
                <label>
                  Student Name
                </label>

                <input
                  type="text"
                  value={
                    selected.candidate ||
                    ""
                  }
                  readOnly
                />
              </div>

              {/* Contact Number */}

              <div className="form-group">
                <label>
                  Contact Number
                </label>

                <input
                  type="text"
                  value={
                    selected.mobile ||
                    selected.phone ||
                    "Not available"
                  }
                  readOnly
                />
              </div>

              {/* Previous Follow-up Date */}

              <div className="form-group">
                <label>
                  Previous Follow-up
                  Date
                </label>

                <input
                  type="date"
                  name="date"
                  value={formatDateForInput(
                    editForm.date
                  )}
                  onChange={
                    handleChange
                  }
                />
              </div>

              {/* Current Status */}

              <div className="form-group">
                <label>
                  Current Status
                </label>

                <input
                  type="text"
                  value={
                    selected.status ||
                    "Pending"
                  }
                  readOnly
                />
              </div>

              {/* Last Discussion */}

              <div className="form-group full">
                <label>
                  Comments / Last
                  Discussion
                </label>

                <textarea
                  name="discussion"
                  value={
                    editForm.discussion ||
                    ""
                  }
                  onChange={
                    handleChange
                  }
                  rows={5}
                  placeholder="Enter follow-up discussion..."
                />
              </div>
            </div>

            {/* ==================================================
                BUTTONS
            ================================================== */}

            <div
              className="form-actions"
              style={{
                marginTop: "18px",
                display: "flex",
                justifyContent:
                  "flex-end",
                gap: "10px",
              }}
            >
              <button
                type="button"
                className="secondary"
                onClick={
                  closeModal
                }
              >
                Close
              </button>

              <button
                type="submit"
                className="primary"
              >
                Save Follow-up
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}