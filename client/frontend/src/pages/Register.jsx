import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [address, setAddress] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [accountType, setAccountType] = useState("public"); // ✅ new field
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    let newErrors = {};

    // Validation
    if (name.length < 3 || name.length > 30) {
      newErrors.name = "Name must be between 3 and 30 characters";
    } else if (!/^[A-Za-z ]+$/.test(name)) {
      newErrors.name = "Name can only contain alphabets and spaces";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match ❌";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Enter a valid email address";
    }

    if (address.trim().length < 10) {
      newErrors.address = "Address must be at least 10 characters long";
    } else if (address.length > 250) {
      newErrors.address = "Address cannot exceed 250 characters";
    }

    if (!profilePic) {
      newErrors.profilePic = "Please upload your profile picture";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("password", password);
      formData.append("address", address);
      formData.append("profilePic", profilePic);
      formData.append("accountType", accountType); // ✅ send account type

      const response = await axios.post("http://localhost:5000/register", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.status >= 200 && response.status < 300) {
        setSuccess(response.data.message || "Registered successfully ✅");
        setErrors({});
        setName("");
        setEmail("");
        setAddress("");
        setPassword("");
        setConfirmPassword("");
        setProfilePic(null);
        setAccountType("public");

        setTimeout(() => {
          navigate("/login");
        }, 1000);
      }
    } catch (err) {
      if (err.response) {
        if (err.response.status === 409) {
          setErrors({ global: "Email already exists ❌" });
        } else {
          setErrors({ global: err.response.data.message || "Something went wrong ❌" });
        }
      } else {
        setErrors({ global: "Server error ❌" });
      }
      setSuccess("");
    }
  };

  return (
    <div className="d-flex flex-column justify-content-center align-items-center bg-light" style={{ minHeight: "100vh" }}>

      <div className="card shadow-lg border-0 rounded-4 p-4" style={{ maxWidth: "550px", width: "100%" }}>
        {/* Heading */}
        <h2 className="text-primary fw-bold mb-4 text-center">Register 🚀</h2>

        {/* Profile Picture */}
        <div className="d-flex justify-content-center mb-4">
          <div className="position-relative">
            <img
              src={profilePic ? URL.createObjectURL(profilePic) : "/profile.jpg"}
              alt="Profile Preview"
              className="rounded-circle border"
              style={{ width: "80px", height: "80px", objectFit: "cover" }}
            />
            <input
              type="file"
              accept="image/jpeg, image/png"
              id="profileUpload"
              style={{ display: "none" }}
              onChange={(e) => setProfilePic(e.target.files[0])}
            />
            <label
              htmlFor="profileUpload"
              className="position-absolute bottom-0 end-0 bg-primary text-white rounded-circle p-1"
              style={{ cursor: "pointer" }}
              title="Upload Profile Picture"
            >
              ✏️
            </label>
            {errors.profilePic && (
              <div className="invalid-feedback d-block">{errors.profilePic}</div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} encType="multipart/form-data">
          {/* Name */}
          <div className="mb-3">
            <label className="form-label fw-semibold">Name</label>
            <input
              type="text"
              className={`form-control ${errors.name ? "is-invalid" : ""}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              required
            />
            {errors.name && <div className="invalid-feedback">{errors.name}</div>}
          </div>

          {/* Email */}
          <div className="mb-3">
            <label className="form-label fw-semibold">Email</label>
            <input
              type="email"
              className={`form-control ${errors.email ? "is-invalid" : ""}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
            {errors.email && <div className="invalid-feedback">{errors.email}</div>}
          </div>

          {/* Address */}
          <div className="mb-3">
            <label className="form-label fw-semibold">Address</label>
            <textarea
              className={`form-control ${errors.address ? "is-invalid" : ""}`}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter your full address"
              rows="2"
              maxLength="250"
              required
            />
            {errors.address && <div className="invalid-feedback">{errors.address}</div>}
          </div>

          {/* Account Type */}
          <div className="mb-3">
            <label className="form-label fw-semibold">Account Type</label>
            <select
              className="form-select"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>

          {/* Password */}
          <div className="mb-3">
            <label className="form-label fw-semibold">Password</label>
            <input
              type={showPassword ? "text" : "password"}
              className={`form-control ${errors.password ? "is-invalid" : ""}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          {/* Confirm Password */}
          <div className="mb-3">
            <label className="form-label fw-semibold">Confirm Password</label>
            <input
              type={showPassword ? "text" : "password"}
              className={`form-control ${errors.confirmPassword ? "is-invalid" : ""}`}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
            />
            {errors.confirmPassword && (
              <div className="invalid-feedback">{errors.confirmPassword}</div>
            )}
          </div>

          {/* Show password toggle */}
          <div className="form-check mb-3">
            <input
              type="checkbox"
              className="form-check-input"
              checked={showPassword}
              onChange={() => setShowPassword(!showPassword)}
              id="showPassword"
            />
            <label htmlFor="showPassword" className="form-check-label">
              Show Password
            </label>
          </div>

          {/* Alerts */}
          {errors.global && <div className="alert alert-danger">{errors.global}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <button type="submit" className="btn btn-primary w-100 fw-semibold">
            Register
          </button>
        </form>

        <div className="text-center mt-3">
          <p className="mb-0">
            Already have an account?{" "}
            <Link to="/login" className="text-decoration-none fw-semibold text-primary">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
