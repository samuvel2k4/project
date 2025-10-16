import React, { useEffect, useState } from "react";
import axios from "axios";

function FollowList() {
 {/* Request Button */}
      {isOwner && profile.accounttype?.toLowerCase() === "private" && (
        <div className="mt-3">
          <button
            className="btn btn-warning"
            onClick={() => setShowRequests(!showRequests)}
          >
            {showRequests ? "Hide Requests" : "Show Requests"} ({pendingRequests.length})
          </button>
        </div>
      )}

      {/* Pending Follow Requests - Toggle */}
      {showRequests && pendingRequests.length > 0 && (
        <div className="card mt-3 p-3 shadow-sm">
          <h5>Pending Follow Requests</h5>
          <ul className="list-group">
            {pendingRequests.map((request) => (
              <li
                key={request.id}
                className="list-group-item d-flex align-items-center justify-content-between"
              >
                <div className="d-flex align-items-center">
                  <img
                    src={
                      request.profile_pic
                        ? `http://localhost:5000/profile/${request.profile_pic}`
                        : "/default-profile.png"
                    }
                    alt={request.username}
                    className="rounded-circle me-3"
                    style={{ width: "50px", height: "50px", objectFit: "cover" }}
                  />
                  <div>
                    <p className="mb-0"><strong>{request.username}</strong></p>
                  </div>
                </div>

                <div>
                  <button
                    className="btn btn-success btn-sm me-2"
                    onClick={() => handleApproveRequest(request.id)}
                  >
                    Accept
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleRejectRequest(request.id)}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
}
export default FollowList;
