import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile'
import Request from './pages/Request';
import { Routes, Route } from "react-router-dom";
import ForgotPassword from './pages/Forgotpassword';
import Resetpassword from './pages/Resetpassword';

function App() {
  return (
    <Routes>
      <Route path='/' element={<Register/>}/>
      <Route path='/register' element={<Register/>}/>
      <Route path='/login' element={<Login/>}/>
      <Route path='/home' element={<Home/>}/>
      <Route path="/profile/:id" element={<Profile />} />
      <Route path="/request" element={<Request/>} />
      <Route path="/forgotpassword" element={<ForgotPassword/>}/>
      <Route path="/reset-password" element={<Resetpassword/>}/>

    </Routes>
  ) 
}

export default App;