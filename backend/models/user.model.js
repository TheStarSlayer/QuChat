import mongoose from "mongoose";
const { Schema, model } = mongoose;

const userSchema = new Schema({
    username: String,
    password: String,
    profilePic: String,
    currentlyActive: Boolean
}, {
    timestamps: true
});

const User = model('User', userSchema);
export default User;