const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('child_process').spawnSync;
const request = require('request');

try {
  const username_input = core.getInput('username');
  const username = username_input ? username_input : github.context.repo.owner
  console.log(`username: ${username}`);
  
  const password = core.getInput('password');
  console.log(`password: ${password}`);


  const sha = github.context.sha
  console.log(`sha: ${sha}`);

  const repo = github.context.repo.owner + '/' + github.context.repo.repo
  var tag
  switch (github.context.eventName) {
      case 'pull_request':
          const pr = github.context.payload.number
          tag = ':PR_' + pr
          action = github.context.payload.action
          console.log(`Pull request #${pr} has been ${action}`);
          break;
      case 'push':
          const ref = github.context.ref
          // refs/heads/${branch} or refs/tags/${tag}
          tag = ref.substring(ref.indexOf('/', 5)+1)
          break;
      default:
          console.log(`This action does not support ${github.context.eventName} events`);
  }


  if (github.context.action == 'closed') {
    request({
      uri: 'https://hub.docker.com/v2/users/login/',
      method: 'POST',
      json: { username: username, password: password }      
    }, function (error, response, body) {  
      console.log("logged in") 
      const auth = `JWT ${body.token}`  

      request({
        uri: `https://hub.docker.com/v2/repositories/${repo}/tags/${tag}/`,
        method: 'DELETE',
        headers : {
          "Authorization" : auth
        }, function (error, response, body) { 
          console.log("tag deleted") 
        }
      });
    });
  } else {
    const loginProcess = exec('docker', [ 'login', '--username', username, '--password', password ]);
    if (loginProcess.status !== 0) {
      core.setFailed(`docker login failed with status code ${loginProcess.status}`);    
    }
    console.log(`Successfully logged in on DockerHub`);
  
    const buildProcess = exec('docker', [ 'build', '-t', repo+':'+tag, '.' ], { stdio: 'inherit' });
    if (buildProcess.status !== 0) {
      core.setFailed(`docker build failed with status code ${buildProcess.status}`);    
    }
    
    const pushProcess = exec('docker', [ 'push', repo+':'+tag], { stdio: 'inherit' });
    if (pushProcess.status !== 0) {
      core.setFailed(`docker push failed with status code ${pushProcess.status}`);    
    }  }




} catch (error) {
  core.setFailed(error.message);
}