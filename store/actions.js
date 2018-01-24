import firebaseApp from '~/firebaseapp'
import firebase from 'firebase'
import {firebaseAction} from 'vuexfire'
import { newFaceGooUser } from '~/utils/utils'
import { userRef, usrPosts, postComments } from '~/utils/firebaseReferences'
import { ratingUserRef, globalRef, userPostRef, newRating, uploadRating, setRating, deleteRating } from '~/utils/ratingReferences'
import uuidv1 from 'uuid/v1'

const _uploadImage = (folder, user) => (file) => {
  let ref = firebaseApp.storage().ref().child(folder + '/' + user)
  return ref.child(uuidv1()).child(file.name).put(file).then(snapshot => {
    return snapshot.downloadURL
  })
}
export default {
  uploadImage ({state}, {files, folder}) {
    return Promise.all(files.map(_uploadImage(folder, state.userId)))
  },
  updatePhotoURL ({state}, photoURL) {
    state.newProfile.update(photoURL)
  },
  createUserAuth ({commit, dispatch}, {email, password, newUser}) {
    firebaseApp.auth().createUserWithEmailAndPassword(email, password).then(({uid}) => {
      commit('setAuthError', '')
      userRef(uid).set(newUser)
      usrPosts(uid).set({user: newUser.email})
    }).catch(error => {
      commit('setAuthError', error.message)
    })
  },
  bindAuth ({commit, dispatch, state}) {
    firebaseApp.auth().onAuthStateChanged(user => {
      if (user) {
        let userReference = userRef(user['uid'])
        userReference.once('value').then(snapshot => {
          if (!snapshot.val()) {
            let postReference = usrPosts(user['uid'])
            userReference.set(newFaceGooUser(user.email))
            postReference.set({user: user.email})
          }
        })
        commit('setUser', user['uid'])
        dispatch('bindFirebaseSetProfile', user['uid'])
      } else {
        dispatch('unbindFirebaseReferences')
      }
    })
  },
  onSetLogOut ({state, dispatch}) {
    firebaseApp.auth().signOut().then(() => {
    }).catch(error => {
      console.log(error)
    })
  },
  addNewRating: firebaseAction(({state, commit, dispatch}, {postid, userpost, score}) => {
    ratingUserRef(postid, state.userId).once('value').then(snapshot => {
      globalRef(postid).once('value').then(snapshot2 => {
        let nScore, beforeScore, newRat
        if (!snapshot.val()) {
          beforeScore = null
          newRat = newRating
        } else {
          beforeScore = snapshot.val().score
          newRat = uploadRating
        }
        nScore = newRat({oldNum: snapshot2.val().num, oldSum: snapshot2.val().sum, beforeScore: beforeScore, score: score})
        setRating({postid: postid, userid: state.userId, userpost: userpost, score: score, newNum: nScore.newNum, newSum: nScore.newSum, newGlobal: nScore.newGlobal})
      })
    })
  }),
  deleteRating: firebaseAction(({state, commit, dispatch}, {postid, userpost}) => {
    let userid = state.userId
    ratingUserRef(postid, userid).once('value').then(snapshot => {
      globalRef(postid).once('value').then(snapshot2 => {
        if (snapshot.val()) {
          let nDelete = deleteRating({oldNum: snapshot2.val().num, oldSum: snapshot2.val().sum, beforeScore: snapshot.val().score})
          userPostRef(userpost, postid).update({points: nDelete.newGlobal})
          globalRef(postid).set({num: nDelete.newNum, sum: nDelete.newSum})
          ratingUserRef(postid, userid).remove()
        }
      })
    })
  }),
  addNewPost ({commit, state, dispatch}, newPost) {
    newPost.date = firebase.database.ServerValue.TIMESTAMP
    userPostRef(state.userId, newPost.post_id).set(newPost)
    postComments(newPost.post_id).set({post_id: newPost.post_id})
    ratingUserRef(newPost.post_id, state.userId).set({user_id: state.userId, score: newPost.points})
    globalRef(newPost.post_id).set({num: 1, sum: newPost.points})
  },
  addNewComment ({state}, newComment) { state.newComment.push(newComment) },
  editProfile ({commit, state}, newProfile) { state.newProfile.update(newProfile) },
  showMorePosts: firebaseAction(({state, commit, dispatch}, pag) => {
    let userPosts = usrPosts(state.userId).orderByChild('date').limitToFirst(pag)
    dispatch('bindFirebaseReference', {reference: userPosts, toBind: 'userPosts'})
  }),
  bindFirebaseSetProfile: firebaseAction(({state, commit, dispatch}, uid) => {
    let userProfile = userRef(uid)
    let userPosts = usrPosts(uid).orderByChild('date').limitToFirst(7)
    dispatch('bindFirebaseReference', {reference: userProfile, toBind: 'userData'}).then(() => { commit('setNewProfile', userProfile) })
    dispatch('bindFirebaseReference', {reference: userPosts, toBind: 'userPosts'})
  }),
  bindFirebaseVPosts: firebaseAction(({state, commit, dispatch}, uid) => {
    let vPosts = usrPosts(uid)
    dispatch('bindFirebaseReference', {reference: vPosts, toBind: 'vPosts'})
  }),
  bindFirebaseComments: firebaseAction(({state, commit, dispatch}, postid) => {
    let postCommnts = postComments(postid)
    dispatch('bindFirebaseReference', {reference: postCommnts, toBind: 'postComments'}).then(() => { commit('addNewComment', postCommnts) })
  }),
  /*
  setPagination: firebaseAction(({state, commit, dispatch}, uid) => {
    console.log('**' + uid)
    usrPosts(uid).orderByChild('date').on('child_added', snapshot => {
      console.log(snapshot.key)
      console.log(snapshot.val())
    })
  }),
  */
  bindFirebaseReference: firebaseAction(({bindFirebaseRef, state}, {reference, toBind}) => {
    return reference.once('value').then(snapshot => {
      if (!snapshot.val()) {
        let values = state[toBind]
        typeof values === 'object' && delete values['.key']
        reference.set(values)
      }
      bindFirebaseRef(toBind, reference)
    })
  }),
  unbindFirebaseReferences: firebaseAction(({unbindFirebaseRef, commit}) => {
    commit('setUser', null)
    commit('setUserData', null)
    commit('setUserPosts', null)
    commit('setUserPosts', [])
    try {
      unbindFirebaseRef('posts')
      unbindFirebaseRef('users')
    } catch (error) {
      return
    }
  })
}