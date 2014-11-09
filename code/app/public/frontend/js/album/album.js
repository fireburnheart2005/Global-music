var albumApp = angular.module('albumApp', []);

albumApp.config(['$routeProvider',function($routeProvider) {
  $routeProvider.
    when('/albums', {
      templateUrl:  templateVersion('frontend/js/album/album.html'),
      controller: 'AlbumCtrl'
    }).
    when('/albums/:type', {
      templateUrl:  templateVersion('frontend/js/album/album.html'),
      controller: 'AlbumCtrl'
    }).
    when('/album/:album_id', {
      templateUrl:  templateVersion('frontend/js/album/album.html'),
      controller: 'AlbumCtrl'
    })
}]);

albumApp.factory('Albums', ['$resource','$cookies',
function($resource,$cookies){
  return $resource( 'albums/:tail' , {}, {
    query: {method:'GET'},
    post: { method:'POST', headers: {'x-csrf-token': csrf}},
    update: {method:'PUT'}
    //, headers: {'x-csrf-token': $cookies.csrftoken , 'UUID':uuid}
  });
}]);


albumApp.controller('AlbumCtrl', 
  function ($scope, $http, $location,$window, $dialogs, $rootScope,
    Albums,$timeout, $routeParams, Page, fSharedService, $userStyle) {
  

  $scope.init = function(){
    
    $scope.pending_add_album = false;
    $scope.resetValue();
    $scope.albums = null;
    $scope.current_album_id = null;
    $scope.type = $routeParams.type;

    var get_params = {};

    if ( $routeParams.album_id ){
      $scope.share_album_id = $routeParams.album_id;
      get_params.id = $routeParams.album_id;
    }


    if ($scope.type == "public"){
      $scope.filter_album = "!";
      $scope.navigation_name ="public_album";
    }
    if (get_params.id){
     $scope.navigation_name ="share_album";  
    }
    else{
     $scope.navigation_name ="album"; 
    }
    Page.setTitle("Browse album");

    Albums.get(get_params, function(res){
      $scope.processRetrieveData(res,function(data){
        log("Data", data);
        //Sort by created date
        data = _.sortBy( data, function(album){ return album.created_date; });
        $scope.albums = data;
        $scope.search_albums = angular.copy( $scope.albums );
        if ( $routeParams.album_id ){
          //Set share album varriable;
          var current_user = $userStyle.getUser(false);
          if (!current_user){
            $userStyle.setUserAlbum($scope.albums[0].user);
            $userStyle.setBodyStyle();
          }

          if ( !$rootScope.share_album_id || $rootScope.share_album_id != get_params.id){
            $rootScope.share_album_id = get_params.id;
            //Active share album
            $scope.activeAlbum($scope.albums[0]);
          }
          
        }
      });
    });
  }

 $scope.$on('handleBroadcast', function() {

    log("listen broad cast on player page");

    var broadcast_data = fSharedService.message.data;
    switch(fSharedService.message.cmd){

      case 'load-songs-done':
        var album_id = broadcast_data.album_id;
        if ( angular.isDefined($scope.share_album_id)  && $scope.share_album_id ==album_id){
          log("let play it");
          //Prevent auto play later
          $scope.share_album_id = null;
          //Send to player controler
          fSharedService.prepForBroadcast({cmd:'play-songs',data: broadcast_data });
        }
        break;
    }
  });

  $scope.activeAlbum = function(album){
    $scope.current_album = album;
    $scope.current_album_id = $scope.current_album._id;
  }

  $scope.showAddModel = function(){
    $scope.resetValue();
    $scope.show_form = true;
    log("weird", $scope.is_edit_album);

    //$scope.initTag();
  }

  $scope.initTag = function(){
    $timeout(function(){
      $('#album-tags').tagsInput({
        width:'auto',
        height:50
      });
    },100);
    
  }

  $scope.removeAlbum = function(remove_album){
    var title = "Are you sure to remove the album: " + remove_album.title;
    $dialogs.confirm( title, function(){
      Albums.remove({id:remove_album._id},function(res){
        $scope.processRetrieveData(res,function(data){
          $scope.removeItemInList( $scope.albums, remove_album._id );
          $scope.removeItemInList( $scope.search_albums, remove_album._id );

          if ( $scope.current_album && $scope.current_album._id == remove_album._id ){
            $scope.current_album_id = null;
            $scope.current_album = null;            
          }
        });
      })
    });
  }

  $scope.shareAlbum = function(album){
    var title = "After you share this album, other user can browse this album and listen to, Do you want to continue ?";
    $dialogs.confirm( title, function(){
      Albums.update({action:"share"}, album,function(res){
        $scope.processRetrieveData(res,function(data){
          $dialogs.success("Your album is shared to public, You can unshare it whenever you want")
          $scope.updateItemInList( $scope.albums, data );
          $scope.updateItemInList( $scope.search_albums, data );
        });
      });
    });  
  }

  $scope.unShareAlbum = function(album){
    Albums.update({action:"unshare"}, album,function(res){
      $scope.processRetrieveData(res,function(data){
        $scope.updateItemInList( $scope.albums, data );
        $dialogs.success("Your album is unshared")
      });
    });
  }

  $scope.showPublicLink = function(album){
    $scope.show_public_link = true;
    log($scope.show_public_link);
    $scope.share_album = album;
    $scope.public_link = document.location.origin +"#/album/"+album._id;
  }

  $scope.resetValue = function(){

    $scope.show_form          = false;
    $scope.album_title        = "";
    $scope.album_cover        = "";
    $scope.album_tags         = "";
    $scope.album_description  = "";
    $scope.is_edit_album      = null;

  }

  $scope.setTagFilter = function(tag_name){
    $scope.filter_album = "#" + tag_name;
    $scope.doSearch();
  }

  $scope.setUserFilter = function(user_name){
    $scope.filter_album = "@" + user_name;
    $scope.doSearch();
  }

  

  $scope.submitAlbum = function(){


    log("submit album");
    var post_data = {
      title         : $scope.album_title,
      cover         : $scope.album_cover,
      description   : $scope.album_description,
      tags          : $('#album-tags').val()
    };
    
    log("post_data", post_data);

    if ( $scope.is_edit_album ){
      $scope.doEditAlbum(post_data);
    }
    else{
      $scope.doAddAlbum(post_data);
    }
  }

  $scope.doAddAlbum = function(post_data){
    $scope.pending_add_album = true;
    Albums.post({}, post_data, function(res){
      $scope.pending_add_album = false;
      $scope.processRetrieveData(res,function(data){
        $scope.albums.push(data);

        if ( $scope.isMatch(data, $scope.search_result) ){
          $scope.search_albums.push( angular.copy(data) );
        }

        $dialogs.success("You added new album");
        $scope.resetValue();
      });
    });
  }

  $scope.editAlbum = function(edit_album){
    $scope.show_form          = true;
    $scope.is_edit_album      = true;
    $scope.album_title        = edit_album.title;
    $scope.edit_album         = angular.copy(edit_album);
    $scope.album_tags         =  _.map( edit_album.tags, function(tag){ return tag.name });
    $scope.album_description  = edit_album.description; 
    log( $scope.album_tags );
    //$scope.initTag();
  }

  $scope.doEditAlbum = function(post_data){
    log("post_data in editAlbum", post_data );
    var copy_album = angular.copy( $scope.edit_album );
    //$scope.is_edit_album = null;
    $scope.pending_edit_album = true;
    
    copy_album = _.extend( copy_album, post_data );
    log("copy_album", copy_album);

    Albums.update({}, copy_album, function(res){
      $scope.pending_edit_album = false;
      $scope.processRetrieveData(res,function(data){
        $scope.updateItemInList( $scope.albums, data );
        $scope.updateItemInList( $scope.search_albums, data );
        //$scope.current_album = data;
        $dialogs.success("The album is updated");
        log( $scope.albums );
        $scope.resetValue();
      });
    });
  }
  //end doEditAlbum

  $scope.doSearch = function(){
    log("filter_album",$scope.filter_album);
    $scope.parseSearch($scope.filter_album, function(result){
      log("result is ", result);
      if ( !result.search_online ){
        $scope.filterOffline(result);
      }
      else{
       $scope.filterOnline(result); 
      }
    });
  }

  $scope.filterOnline = function(search_result){
    console.error("filter online");
    $scope.do_searching_online = true;

    var query_data = angular.copy(search_result);
    query_data.tail = 'search';

    Albums.get(query_data, search_result, function(res){
      $scope.do_searching_online = false;
      $scope.processRetrieveData(res, function(albums){
        $scope.search_albums = albums;
      })
    });

  }

  $scope.filterOffline = function( result ){

    $scope.search_result = result;

    if (result.full == "" || result.full == null){
      log("nothing to search");
      return $scope.search_albums = angular.copy( $scope.albums );
    }

    var temp_albums = [];

    for ( var i=0; i < $scope.albums.length; i++ ){
      log("llop");
      var album = $scope.albums[i];

      if ( $scope.isMatch( album, result ) ){
        temp_albums.push( angular.copy(album) );
      }      
    }

    $scope.search_albums = temp_albums;
  };

  $scope.isMatch = function( album, search_result ){

    if (!angular.isDefined(search_result)){
      return true;
    }

    if (search_result.keyword && album.search_title.toLowerCase().search(search_result.keyword) == -1){
      //Skip on this album
      return false;
    }

    if (search_result.tag){

      var j = 0;
      for ( j=0; j < album.tags.length;j++ ){
        if (album.tags[j].name.toLowerCase().search( search_result.tag ) != -1){
          break;
        }
      }
      if (j == album.tags.length){
        //Skip on this album
        return false;
      }
    }

    return true;

  }

  $scope.isOwn = function(user_id){
    if (!$scope.user){
      //user not login
      return false;
    }
    return $scope.user._id == user_id;
  }

  $scope.parseSearch = function(keyword, callback){
    keyword = $.trim(angular.copy( keyword ));
    if ( $scope.is_searching || $scope.do_searching_online ){
      log("ignore");
      return;
    }

    var public_indicator = "~public";

    var result = {
      keyword:null,
      tag:null,
      user: null,
      is_public:false,
      full:keyword
    };

    if ( keyword == "" ){
      log("Stop here");
      return callback(keyword);
    }


    if (keyword.search( public_indicator ) != -1 ){
      result.is_public = true;
      keyword = keyword.replace( public_indicator,"");
    }

    var regex = keyword.match(/@[\w]*/i);
    
    if ( regex ){
      log("res", regex);
      keyword = keyword.substr(0,regex.index -1)  + keyword.substr( regex.index + regex[0].length );
      
      var search_user = regex[0].substr(1);

      if ( search_user != "" ){
        result.user = search_user;
      }
    }

    regex = keyword.match(/#[\w]*/i);

    if ( regex  ){
      result.tag = regex[0].substr(1).toLowerCase();
      keyword = keyword.substr(0,regex.index -1)  + keyword.substr( regex.index + regex[0].length );
    }

    result.keyword = removeUnicode($.trim(keyword).toLowerCase());

    log("result is", result);

    if ( result.user != null ){
      if ( !$scope.user || ($scope.user && result.user != $scope.user.user_name ) ){
        result.is_public = true;
        result.search_online = true;
        log("search public");
        return callback(result);        
      }
      else{
        result.search_online = false;
        log("Search local1");
        callback(result);
      }
    }
    else{
      if (result.is_public){
        result.search_online = true;
        log("search public");
        return callback(result);
      }
      else{
        result.search_online = false;
        callback(result);
        log("Search local");
      }

    }
  }
});