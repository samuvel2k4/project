import React, { useEffect, useState, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../authcontext.jsx";

function Home() {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);

  // -------------------- State --------------------
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [following, setFollowing] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [buttonLoading, setButtonLoading] = useState({});

  // Chunk loading
  const usersPerChunk = 6; // chunk size
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const initialLoadDone = useRef(false);

  // -------------------- Handlers --------------------
  const handleLogout = () => {
    logout();
    navigate("/register");
  };

  const handleProfileClick = () => {
    if (user?.id) navigate(`/profile/${user.id}`);
  };

  // -------------------- Fetch Users Chunk --------------------
  const fetchUsersChunk = async (currentOffset = offset) => {
    if (!user?.id || !hasMore) return;

    try {
      currentOffset === 0 ? setLoading(true) : setLoadingMore(true);
      const token = localStorage.getItem("token");

      const page = Math.floor(currentOffset / usersPerChunk) + 1;

     const res = await axios.get(
  `http://localhost:5000/users/users?page=${page}&limit=${6}&loggedInUserId=${user.id}`,
  {
    headers: { Authorization: `Bearer ${token}` },
  }
);

      // Backend returns { page, limit, total, users: [...] }
      const fetchedUsers = res.data.users || [];
      const totalUsers = res.data.total || 0;

      console.log("Fetched users IDs:", fetchedUsers.map(u => u.id));
      console.log("Number of users fetched:", fetchedUsers.length);
      console.log("Total users in backend:", totalUsers);

      // Append & deduplicate
      setUsers(prev => {
        const combined = [...prev, ...fetchedUsers];
        const unique = Array.from(new Map(combined.map(u => [u.id, u])).values());
        console.log("Total users after deduplication:", unique.length);
        return unique;
      });

      // Update offset
      setOffset(prev => prev + fetchedUsers.length);
      console.log("Next offset will be:", currentOffset + fetchedUsers.length);

      // Stop fetching if fewer than chunk size or reached total
      if (fetchedUsers.length < usersPerChunk || offset + fetchedUsers.length >= totalUsers) {
        setHasMore(false);
      }

      // Fetch follow status only once
      if (currentOffset === 0) {
        const followRes = await axios.get(`http://localhost:5000/following/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFollowing(followRes.data.following || []);
        setPendingRequests(followRes.data.pendingRequests || []);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to fetch users");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // -------------------- Follow / Unfollow / Request --------------------
  const handleFollowToggle = async (targetUser) => {
    setButtonLoading(prev => ({ ...prev, [targetUser.id]: true }));
    try {
      const token = localStorage.getItem("token");
      let action = "follow";
      let isRequest = false;

      if (following.includes(targetUser.id)) action = "unfollow";
      else if (targetUser.accounttype === "private") isRequest = true;

      const res = await axios.post(
        "http://localhost:5000/follow",
        { userId: user.id, targetId: targetUser.id, action, isRequest },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        if (action === "unfollow") {
          setFollowing(prev => prev.filter(id => id !== targetUser.id));
          setPendingRequests(prev => prev.filter(id => id !== targetUser.id));
        } else if (isRequest) {
          setPendingRequests(prev => [...prev, targetUser.id]);
        } else {
          setFollowing(prev => [...prev, targetUser.id]);
        }
      } else {
        alert(res.data.message || "Action failed");
      }
    } catch (err) {
      console.error("Follow/unfollow error:", err);
      alert("Something went wrong");
    } finally {
      setButtonLoading(prev => ({ ...prev, [targetUser.id]: false }));
    }
  };

  // -------------------- Lifecycle --------------------
  useEffect(() => {
    if (user?.id && !initialLoadDone.current) {
      initialLoadDone.current = true;
      setUsers([]);
      setOffset(0);
      setHasMore(true);
      fetchUsersChunk(0);
    }
  }, [user?.id]);

  const handleLoadMore = () => {
    console.log("Load More clicked. Current offset:", offset);
    if (!loadingMore && hasMore) fetchUsersChunk(offset);
  };

  // -------------------- JSX --------------------
  return (
    <div className="container mt-4">
      {/* Header */}
      <div
        className="d-flex justify-content-between align-items-center mb-4 p-3 rounded shadow text-white"
        style={{ background: "linear-gradient(90deg, #0d6efd, #6610f2)" }}
      >
        <h2 className="fw-bold m-0">🏠 Home</h2>
        <p className="text-center fw-bold m-0">Hi, {user?.name || "Guest"}!</p>
        <div className="d-flex gap-2">
          <button className="btn btn-light btn-sm fw-bold" onClick={handleProfileClick}>Profile</button>
          <button className="btn btn-light btn-sm fw-bold" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <h4 className="mb-3 text-center text-secondary">👥 Explore Users</h4>

      {loading && <p className="text-center text-muted">Loading users...</p>}
      {error && <p className="text-danger text-center">{error}</p>}

      {/* Users Grid */}
      <div className="row g-3">
        {users.map(u => (
          <div key={u.id} className="col-md-6 col-sm-12">
            <div
              className="card shadow-sm border-0 h-100 hover-shadow"
              style={{ transition: "transform 0.2s" }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-5px)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
            >
              <div className="card-body d-flex align-items-center">
                <img 
                  src={u.profile_pic ? `http://localhost:5000/profile/${u.profile_pic}` : "/default-profile.png"}
                  alt={u.name}
                  className="rounded-circle border border-secondary me-3"
                  style={{ width: "60px", height: "60px", objectFit: "cover" }}
                />
                <div className="flex-grow-1">
                  <h6 className="mb-1 fw-bold">{u.name}</h6>
                  <small className="text-muted d-block mb-1">{u.email}</small>
                  <div className="d-flex align-items-center gap-2">
                    <small className="text-primary">{u.accounttype}</small>
                    {u.accounttype === "private" && !following.includes(u.id) && !pendingRequests.includes(u.id) && (
                      <span className="badge bg-warning text-dark">Private</span>
                    )}
                  </div>
                </div>

                {/* Follow / Requested / Following Button */}
                {following.includes(u.id) ? (
                  <button
                    className="btn btn-success btn-sm rounded-pill ms-2"
                    disabled={buttonLoading[u.id]}
                    onClick={() => handleFollowToggle(u)}
                  >
                    {buttonLoading[u.id] ? "⏳..." : "✔ Following"}
                  </button>
                ) : pendingRequests.includes(u.id) ? (
                  <button className="btn btn-warning btn-sm rounded-pill ms-2" disabled>
                    ⏳ Requested
                  </button>
                ) : (
                  <button
                    className="btn btn-outline-primary btn-sm rounded-pill ms-2"
                    disabled={buttonLoading[u.id]}
                    onClick={() => handleFollowToggle(u)}
                  >
                    {buttonLoading[u.id] ? "⏳..." : "+ Follow"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      {hasMore && !loading && users.length > 0 && (
        <div className="text-center mt-4">
          <button className="btn btn-primary" disabled={loadingMore} onClick={handleLoadMore}>
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
      {!hasMore && users.length > 0 && (
        <p className="text-center text-muted mt-3">No more users to load.</p>
      )}
      {!loading && users.length === 0 && <p className="text-center text-muted mt-3">No users found.</p>}
    </div>
  );
}

export default Home;
