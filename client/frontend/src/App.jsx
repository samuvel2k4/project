import Home from './pages/Home';
import './App.css'
import Login from './pages/Login';
import Register from './pages/Register';
import { Routes, Route } from "react-router-dom";

function App() {
  return (
    <Routes>
      <Route path='/' element={<Register/>}/>
      <Route path='/register' element={<Register/>}/>
      <Route path='/login' element={<Login/>}/>
      <Route path='/home' element={<Home/>}/>

    </Routes>
  ) 
}

export default App;