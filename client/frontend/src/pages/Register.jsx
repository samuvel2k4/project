import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState("");
  const [address, setAddress] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    let newErrors = {};
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

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("password", password);
      formData.append("address", address);
      if (profilePic) formData.append("profilePic", profilePic);

      const response = await fetch("http://localhost:5000/register", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("You registered successfully ✅");
        setErrors({});
        setName("");
        setEmail("");
        setAddress("");
        setPassword("");
        setConfirmPassword("");
        setProfilePic(null);
        navigate("/login");
      } else {
        setErrors({ global: data.message || "Something went wrong ❌" });
        setSuccess("");
      }
    } catch (err) {
      setErrors({ global: "Server error ❌" });
      setSuccess("");
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-50 mx-auto bg-light">
      <div
        className="card shadow-lg border-0 rounded-4 p-4"
        style={{ width: "550px" }}
      >
        {/* Heading + Profile Pic */}
        <div className="d-flex justify-content-between align-items-right mb-3">
          <h2 className="text-primary fw-bold">Register 🚀</h2>

          <div className="position-relative">
      {/* Show preview (fallback to default image) */}
      <img
        src={
          profilePic
            ? URL.createObjectURL(profilePic)
            : "profile.jpg"
        }
        alt="Profile Preview"
        className="rounded-circle border"
        style={{ width: "80px", height: "80px", objectFit: "cover" }}
      />

      {/* Hidden file input */}
      <input
        type="file"
        accept="image/jpeg, image/png"
        id="profileUpload"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files[0];
          if (file) {
            setProfilePic(file); // ✅ save file to state
          }
        }}
      />

      {/* Pencil icon overlay */}
      <label
        htmlFor="profileUpload"
        className="position-absolute bottom-0 end-0 bg-primary text-white rounded-circle p-1"
        style={{ cursor: "pointer" }}
        title="Upload Profile Picture"
      >
        ✏️
      </label>
    </div>
    </div>

        {/* FORM */}
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
            {errors.name && (
              <div className="invalid-feedback">{errors.name}</div>
            )}

            <small className="text-muted">
              Avoid using (*&^%$#@!?)
            </small>
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
            {errors.email && (
              <div className="invalid-feedback">{errors.email}</div>
            )}
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
              required
              maxLength="250"
            />
            {errors.address && (
              <div className="invalid-feedback">{errors.address}</div>
            )}
            <small className="text-muted">
              {address.length}/250 characters
            </small>
          </div>

          {/* Password */}
          <div className="mb-3">
            <label className="form-label fw-semibold">Password</label>
            <input
              type={showPassword ? "text" : "password"}
              className="form-control"
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
              className={`form-control ${
                errors.confirmPassword ? "is-invalid" : ""
              }`}
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
          {errors.global && (
            <div className="alert alert-danger">{errors.global}</div>
          )}
          {success && <div className="alert alert-success">{success}</div>}

          {/* Submit */}
          <button type="submit" className="btn btn-primary w-100 fw-semibold">
            Register
          </button>
        </form>

        <hr />
        <div className="text-center mt-3">
          <p className="mb-0">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-decoration-none fw-semibold text-primary"
            >
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
