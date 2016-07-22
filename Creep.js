import {Creep} from 'screeps-globals';
import Util from 'Util';

export default class CustomCreep extends Creep{
	constructor(creep){
        super(creep);
        // this.say(this.memory.role);
    }

    transferEnergy(storage){
        var result = this.transfer(storage, RESOURCE_ENERGY);
        if(result == ERR_NOT_IN_RANGE){
            this.creepMove(storage);
        }else if(result != 0){
            console.log(this.name + ' failed to transfer energy to ' + storage + ' with error: ' + result);
        }
    }

    getClaimedSources(){
        var miners = _(Game.creeps).filter({ memory: { role: 'miner' }}).value();
        var sources = [];
        for(let miner in miners){
            if('source' in miners[miner].memory){
                // console.log('Source ' + miners[miner].memory.source.id + ' is taken');
                sources.push(miners[miner].memory.source.id);
            }

        }
        // console.log('Found sources: ' + sources.toString());
        return sources;
    }

    creepMove(destination){
        var moveCode = this.moveTo(destination, {noPathFinding: true})

        if(moveCode == ERR_NO_PATH || moveCode == ERR_NOT_FOUND){
            moveCode = this.moveTo(destination)
        }
        if(moveCode != 0 && moveCode != -11){
            console.log('Creep ' + this.name + ' was unable to move. ERR: ' + moveCode);
        }
    }

    moveInRandomDirection(){
        const directions = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
        this.move(Math.floor(Math.random(directions.length) * directions.length));
    }

    upgradeWork(){
        if(this.memory.state == 'gathering'){
            if(this.carry.energy < this.carryCapacity){
                this.withdrawEnergyFromClosestStorage();
            } else {
                this.memory.state = 'working';
            }
        } else if(this.memory.state == 'working'){
            if (this.carry.energy > 0){
                if(this.upgradeController(this.room.controller) == ERR_NOT_IN_RANGE) {
                    this.creepMove(this.room.controller);
                }
            } else {
                this.memory.state = 'gathering';
            }
        } else{
            this.memory.state = 'gathering';
        }
        return true;
    }

    buildWork(){
        if(this.room.controller.ticksToDowngrade < 1000){
            console.log('TicksToDowngrade are less than 1,000! Upgrading Controller.');
            this.upgradeWork();
        }else if(this.memory.state == 'gathering'){
            if(this.carry.energy < this.carryCapacity){
                this.withdrawEnergyFromClosestStorage();
            } else {
                this.memory.state = 'working';
            }
        } else if(this.memory.state == 'working'){
            if(this.carry.energy == 0){
                this.memory.state = 'gathering';
            }else{
                if(!this.tryToConstruct()){
                    this.upgradeWork();
                }
            }
        } else{
            this.memory.state = 'gathering';
        }
    }

    harvestWork(){
        if(this.memory.state == 'gathering'){
            if(this.carry.energy < this.carryCapacity){
                this.harvestEnergy();
            } else {
                this.memory.state = 'working';
            }
        } else if(this.memory.state == 'working'){
            if (this.carry.energy > 0){
                var priorityList = [STRUCTURE_EXTENSION, STRUCTURE_SPAWN, STRUCTURE_CONTAINER, STRUCTURE_CONTROLLER];
                for(let structureType in priorityList){
                    var strorageStructure = this.pos.findClosestByRange(FIND_STRUCTURES, {filter: (i) => !Util.isEnergyStorageFull(i) && i.structureType == priorityList[structureType]});
                    // console.log('harvester lookting to dump energy in ' + priorityList[structureType]);
                    if(strorageStructure != null){
                        // console.log('harvester ' + this.name + ' looking to dump energy in ' + priorityList[structureType] + ' - ' + strorageStructure);
                        this.transferEnergy(strorageStructure);
                        return true;
                    }
                }
                console.log('Attempt to harvest failed as we are full up on energy!');
                return false;
            } else {
                this.memory.state = 'gathering';
            }
        } else{
            this.memory.state = 'gathering';
        }
        return true;
    }

    generalAttack(target){
        var tmp = this.rangedAttack(target);
        if(tmp == ERR_NO_BODYPART){
            tmp = this.attack(target);
        }
        if(tmp == ERR_NOT_IN_RANGE){
            this.creepMove(target);
        }
    }

    withdrawEnergyFromClosestStorage(){
        // console.log('Energy percent available: ' + this.room.energyCapacityAvailable + ' ' + this.room.energyAvailable + ' ' + (this.room.energyAvailable / this.room.energyCapacityAvailable));
        var storageStructure = this.pos.findClosestByRange(FIND_STRUCTURES, {filter: (i) => i.structureType == STRUCTURE_CONTAINER && i.store[RESOURCE_ENERGY] > (this.carryCapacity - _.sum(this.carry))});
        if(storageStructure != null){
            // console.log('Energy percent available: ' + this.room.energyCapacityAvailable + ' ' + this.room.energyAvailable + ' ' + (this.room.energyAvailable / this.room.energyCapacityAvailable));
            // console.log(this.name + ' found Container with enough energy to grab');
            if(this.withdraw(storageStructure, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                this.creepMove(storageStructure);
            }
        } else{
            this.harvestEnergy();
        }
    }

    getClosestAvailableSource(){
        var source = Game.getObjectById(this.memory.source);
        if(source == null){
            // console.log('Source was null');
            source = this.pos.findClosestByRange(FIND_SOURCES);
            this.memory.source = source.id;
        }
        var idList = [source.id];
        var tmp = 0;
        while(!this.isSourceAvailable(source)){
            // console.log('Cannot use source: ' + source);
            source = this.pos.findClosestByRange(FIND_SOURCES, {filter: (i) => idList.indexOf(i.id) == -1});
            if(source == null){
                // console.log('OUCH: something went wrong and we could not find a source: ' + idList);
                return;
            }
            // console.log('source: ' + source);
            idList.push(source.id);
            tmp += 1;
        }
        this.memory.source = source.id;
        return source;
    }

    isSourceAvailable(source){
        var available = false;
        // console.log('Checking if ' + source + ' is available');
        if(Math.abs(source.pos.x - this.pos.x) <= 1 && Math.abs(source.pos.y - this.pos.y) <= 1){ //If you are already right next to the source
            // console.log('Creep ' + this.name + ' is right next to a source!');
            return true;
        } else {
            var searchSpots = [-1, 0, 1];
            for(var x in searchSpots){
                x = source.pos.x + searchSpots[x];
                for(var y in searchSpots){
                    y = source.pos.y + searchSpots[y];
                    if(x != source.pos.x && y != source.pos.y){
                        // console.log('location: ' + x + ',' + y);
                        var objects = this.room.lookAt(x, y);
                        var tmpAvailable = true;
                        for(let obj in objects){
                            // console.log('there is a ' + objects[obj].type + ' at ' + x + ',' + y);
                            if(['creep'].indexOf(objects[obj].type) == -1 && ((objects[obj].type == 'terrain') ? (objects[obj].terrain != 'wall') : (true))){
                                // console.log('Space is available for ' + this.name + ' to harvest at ' + x + ',' + y + ' for object ' + objects[obj].type + OBSTACLE_OBJECT_TYPES.indexOf(objects[obj].type));
                            } else {
                                tmpAvailable = false;
                                // console.log('Space is NOT available for ' + this.name + ' to harvest at ' + x + ',' + y + ' for object ' + objects[obj].type + OBSTACLE_OBJECT_TYPES.indexOf(objects[obj].type));
                            }
                        }
                        if(tmpAvailable){
                            available = true;
                            // console.log('Space is available for ' + this.name + ' to harvest at ' + x + ',' + y);
                        }
                    }
                }
            }
        }
        // console.log('Source is not available for ' + this.name + ' ' + available);
        return available;
    }

    harvestEnergy(){
    	// console.log('Harvesting Energy!');
    	// var source = this.pos.findClosestByRange(FIND_SOURCES);
        var source = this.getClosestAvailableSource();
        if(this.harvest(source) == ERR_NOT_IN_RANGE){
            this.creepMove(source);
        }
    }

    tryToConstruct(){
        var priorityList = [STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_CONTAINER, STRUCTURE_WALL, STRUCTURE_RAMPART, STRUCTURE_ROAD, STRUCTURE_CONTROLLER];
        var toRepair = Game.getObjectById(this.memory.toRepair);
        if(toRepair != null){
            if((toRepair.structureType == STRUCTURE_WALL || toRepair.structureType == STRUCTURE_RAMPART) ? (toRepair.hits < 1500 && toRepair.hits != toRepair.hitsMax) : (toRepair.hitsMax - toRepair.hits)){
                // console.log('Repairing ' + toRepair + ' based on Memory! ' + (toRepair.structureType == STRUCTURE_WALL), (toRepair.hits < 1000), toRepair.hits);
                if(this.repair(toRepair) == ERR_NOT_IN_RANGE){
                    this.creepMove(toRepair);
                }
                return true;
            }
        }
        for(let structure in priorityList){
            var closestConstructionSite = this.pos.findClosestByRange(FIND_STRUCTURES, {filter: (i) => (i.structureType == priorityList[structure]) && ((i.structureType == STRUCTURE_WALL || i.structureType == STRUCTURE_RAMPART) ? (i.hits < 1000 && i.hits != i.hitsMax) : (i.hits / i.hitsMax < 0.75))});
            if(closestConstructionSite != null){
                // console.log(this.name + ' needs to repair ' + closestConstructionSite);
                this.memory.toRepair = closestConstructionSite.id
                if(this.repair(closestConstructionSite) == ERR_NOT_IN_RANGE){
                    this.creepMove(closestConstructionSite);
                }
                return true;
            } else {
                // console.log('We don\'t have any ' + priorityList[structure] + ' to repair');
            }
        }
        for(let structure in priorityList){
            var closestConstructionSite = this.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {filter: (i) => i.structureType == priorityList[structure]});
            if(closestConstructionSite != null){
                if(this.build(closestConstructionSite) == ERR_NOT_IN_RANGE){
                    this.creepMove(closestConstructionSite);
                }
                return true;
            }
        }
        return false;
    }
}