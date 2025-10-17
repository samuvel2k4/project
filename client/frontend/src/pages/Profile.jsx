import React, { useEffect, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../authcontext.jsx";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

function Profile() {
  const { id } = useParams();
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    accountType: "public",
    phoneNo: "",
    address: "",
  });

  const [pendingRequests, setPendingRequests] = useState([]);
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [followersTotal, setFollowersTotal] = useState(0);
  const [followingTotal, setFollowingTotal] = useState(0);
  const [followersPage, setFollowersPage] = useState(1);
  const [followingPage, setFollowingPage] = useState(1);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const itemsPerPage = 3;
  const [showFollowersList, setShowFollowersList] = useState(false);
  const [showFollowingList, setShowFollowingList] = useState(false);

  const isOwner = user && id && Number(user.id) === Number(id);

  // -----------------------------
  // Fetch profile
  // -----------------------------
  useEffect(() => {
    const fetchProfile = async () => {
      if (!id || !user) return;
      setLoadingProfile(true);
      try {
        const res = await axios.get(`http://localhost:5000/users/${id}`);
        const profileData = res.data;

        setProfile(profileData);
        setFormData({
          username: profileData.username || "",
          email: profileData.email || "",
          accountType: profileData.accountType || "public",
          phoneNo: profileData.phoneNo || "",
          address: profileData.address || "",
        });

        if (isOwner && profileData.accountType?.toLowerCase() === "private") {
          const requestsRes = await axios.get(`http://localhost:5000/followreq/${id}`);
          setPendingRequests(requestsRes.data.pendingRequests || []);
        }

        // Reset followers/following
        setFollowersList([]);
        setFollowingList([]);
        setFollowersPage(1);
        setFollowingPage(1);
        fetchFollowers(1);
        fetchFollowing(1);
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [id, user]);

  // -----------------------------
  // Fetch followers / following
  // -----------------------------
  const fetchFollowers = async (page = 1) => {
    if (!id) return;
    setLoadingFollowers(true);
    try {
      const res = await axios.get(
        `http://localhost:5000/followreq/followers/list/${id}?page=${page}&limit=${itemsPerPage}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = res.data;

      setFollowersList((prev) => {
        const combined = [...prev, ...data.followers];
        const unique = Array.from(new Map(combined.map((u) => [u.id, u])).values());
        return unique;
      });
      setFollowersTotal(data.total);
    } catch (err) {
      console.error("Error fetching followers:", err);
    } finally {
      setLoadingFollowers(false);
    }
  };

  const fetchFollowing = async (page = 1) => {
    if (!id) return;
    setLoadingFollowing(true);
    try {
      const res = await axios.get(
        `http://localhost:5000/followreq/following/list/${id}?page=${page}&limit=${itemsPerPage}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = res.data;

      setFollowingList((prev) => {
        const combined = [...prev, ...data.following];
        const unique = Array.from(new Map(combined.map((u) => [u.id, u])).values());
        return unique;
      });
      setFollowingTotal(data.total);
    } catch (err) {
      console.error("Error fetching following:", err);
    } finally {
      setLoadingFollowing(false);
    }
  };

  // -----------------------------
  // Handle input changes
  // -----------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // -----------------------------
  // Update profile (with +phone fix)
  // -----------------------------
  const handleUpdate = async () => {
    try {
      // Ensure phone number includes "+" prefix
      const formattedPhone =
        formData.phoneNo && !formData.phoneNo.startsWith("+")
          ? `+${formData.phoneNo}`
          : formData.phoneNo;

      const res = await axios.put(`http://localhost:5000/users/${id}`, {
        username: formData.username,
        email: formData.email,
        accountType: formData.accountType,
        phoneNo: formattedPhone,
        address: formData.address,
        loggedInUserId: user.id,
      });

      const updatedProfile = res.data;

      // Update profile and formData
      setProfile(updatedProfile);
      setFormData({
        username: updatedProfile.username || "",
        email: updatedProfile.email || "",
        accountType: updatedProfile.accountType || "public",
        phoneNo: updatedProfile.phoneNo || "",
        address: updatedProfile.address || "",
      });

      setEditing(false);
      alert("Profile updated!");
    } catch (err) {
      console.error("Failed to update profile:", err);
      alert("Failed to update profile");
    }
  };

  // -----------------------------
  // Pending request actions
  // -----------------------------
  const handleRequestAction = async (requestId, action) => {
    try {
      await axios.post(`http://localhost:5000/followreq/handle/${requestId}`, {
        ownerId: user.id,
        action,
      });

      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));

      if (action === "approve") {
        const approvedUser = pendingRequests.find((r) => r.id === requestId);
        if (approvedUser) {
          setFollowersList((prev) => [...prev, { ...approvedUser, isFollowing: false }]);
          setFollowersTotal((prev) => prev + 1);
        }
      }
    } catch (err) {
      console.error("Follow request action failed:", err);
      alert(`Failed to ${action === "approve" ? "approve" : "reject"} request`);
    }
  };

  // -----------------------------
  // Follow / Unfollow toggle
  // -----------------------------
  const handleFollowToggle = async (targetUserId, isFollowing) => {
    try {
      await axios.post("http://localhost:5000/follow", {
        userId: user.id,
        targetId: targetUserId,
        action: isFollowing ? "unfollow" : "follow",
      });

      setFollowersList((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, isFollowing: !isFollowing } : u))
      );
      setFollowingList((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, isFollowing: !isFollowing } : u))
      );
    } catch (err) {
      console.error("Follow/unfollow failed:", err);
      alert("Action failed");
    }
  };

  // -----------------------------
  // Render
  // -----------------------------
  if (loadingProfile) return <p className="text-center mt-4">Loading profile...</p>;
  if (!profile) return <p className="text-center mt-4">Profile not found</p>;

  return (
    <div className="container mt-4">
      <button className="btn btn-outline-secondary mb-4" onClick={() => navigate("/home")}>
        ⬅️ Back
      </button>

      <div className="row">
        {/* Left Column */}
        <div className="col-md-8">
          <div className="card shadow-sm p-4 mb-4">
            <div className="d-flex align-items-center mb-3">
              <img
                src={
                  profile.profile_pic
                    ? `http://localhost:5000/profile/${profile.profile_pic}`
                    : "/default-profile.png"
                }
                alt={profile.username}
                className="rounded-circle border border-secondary me-3"
                style={{ width: "100px", height: "100px", objectFit: "cover" }}
              />
              <div className="flex-grow-1">
                <div className="d-flex align-items-center mb-2">
                  <h4 className="me-3 mb-0">{profile.username}</h4>
                  {isOwner && (
                    <button
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => setEditing(true)}
                    >
                      Edit Profile
                    </button>
                  )}
                </div>
                <div className="d-flex gap-3">
                  <span style={{ cursor: "pointer" }} onClick={() => setShowFollowersList((p) => !p)}>
                    <strong>{followersTotal}</strong> Followers
                  </span>
                  <span style={{ cursor: "pointer" }} onClick={() => setShowFollowingList((p) => !p)}>
                    <strong>{followingTotal}</strong> Following
                  </span>
                </div>
              </div>
            </div>

            {editing ? (
              <div className="mt-3">
                <div className="mb-2">
                  <label className="form-label">Username</label>
                  <input
                    className="form-control"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label">Email</label>
                  <input
                    className="form-control"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label">Phone Number</label>
                  <PhoneInput
                    country={"us"}
                    value={formData.phoneNo}
                    onChange={(phone) => setFormData((prev) => ({ ...prev, phoneNo: phone }))}
                    inputProps={{
                      name: "phoneNo",
                      required: true,
                      className: "form-control",
                    }}
                    containerClass="w-100"
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label">Address</label>
                  <input
                    className="form-control"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Account Type</label>
                  <select
                    className="form-select"
                    name="accountType"
                    value={formData.accountType}
                    onChange={handleChange}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-success" onClick={handleUpdate}>
                    Save
                  </button>
                  <button className="btn btn-secondary" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <p>
                  <strong>Email:</strong>{" "}
                  {isOwner || profile.accountType?.toLowerCase() === "public"
                    ? profile.email
                    : "Private"}
                </p>
                <p>
                  <strong>Phone Number:</strong>{" "}
                  {isOwner || profile.accountType?.toLowerCase() === "public"
                    ? profile.phoneNo || "-"
                    : "Private"}
                </p>
                <p>
                  <strong>Address:</strong>{" "}
                  {isOwner || profile.accountType?.toLowerCase() === "public"
                    ? profile.address || "-"
                    : "Private"}
                </p>
                <p>
                  <strong>Account Type:</strong> {profile.accountType}
                </p>
              </div>
            )}

            {/* Followers and Following sections remain unchanged */}
            {/* ... */}
          </div>
        </div>

        {/* Right Column: Pending Requests */}
        {isOwner && profile.accountType?.toLowerCase() === "private" && (
          <div className="col-md-4">
            <div className="card shadow-sm p-3 mb-4" style={{ maxHeight: "600px", overflowY: "auto" }}>
              <h5>Pending Requests ({pendingRequests.length})</h5>
              {pendingRequests.length === 0 ? (
                <p className="mt-2">No pending requests.</p>
              ) : (
                pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="d-flex justify-content-between align-items-center mb-2 p-2 border rounded"
                  >
                    <div className="d-flex align-items-center">
                      <img
                        src={
                          req.profile_pic
                            ? `http://localhost:5000/profile/${req.profile_pic}`
                            : "/default-profile.png"
                        }
                        alt={req.username}
                        className="rounded-circle me-3"
                        style={{ width: "50px", height: "50px", objectFit: "cover" }}
                      />
                      <span>{req.username}</span>
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleRequestAction(req.id, "approve")}
                      >
                        Accept
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRequestAction(req.id, "reject")}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;
