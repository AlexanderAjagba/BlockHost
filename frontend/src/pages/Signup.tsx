import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useNavigate } from 'react-router-dom';

export const Signup = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) return setError("Passwords do not match");
    if (formData.password.length < 6) return setError("Password must be at least 6 characters");

    try {
      const res = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      // Store user profile in Firestore
      await setDoc(doc(db, "users", res.user.uid), {
        name: formData.name,
        email: formData.email,
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message === 'Firebase: Error (auth/email-already-in-use).' 
        ? 'Email already exists.' 
        : 'Failed to create account.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-6 text-center">Sign Up</h2>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        
        <input 
          type="text" placeholder="Name" className="w-full p-2 mb-4 border rounded"
          onChange={(e) => setFormData({...formData, name: e.target.value})} required 
        />
        <input 
          type="email" placeholder="Email" className="w-full p-2 mb-4 border rounded"
          onChange={(e) => setFormData({...formData, email: e.target.value})} required 
        />
        <input 
          type="password" placeholder="Password" className="w-full p-2 mb-4 border rounded"
          onChange={(e) => setFormData({...formData, password: e.target.value})} required 
        />
        <input 
          type="password" placeholder="Confirm Password" className="w-full p-2 mb-4 border rounded"
          onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} required 
        />
        
        <button className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">Sign Up</button>
        <p className="mt-4 text-sm text-center">
          Already have an account? <a href="/login" className="text-blue-600">Login</a>
        </p>
      </form>
    </div>
  );
};