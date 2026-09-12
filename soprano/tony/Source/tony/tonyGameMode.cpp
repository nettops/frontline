// Copyright Epic Games, Inc. All Rights Reserved.

#include "tonyGameMode.h"
#include "RestaurantBuilder.h"
#include "Engine/World.h"

AtonyGameMode::AtonyGameMode()
{
	// stub
}

void AtonyGameMode::BeginPlay()
{
	Super::BeginPlay();

	// Spawned, not placed — no Editor step required to have a restaurant
	// in the level. Location is the world origin; the existing template
	// playground content is cosmetic and can overlap it without breaking
	// anything, since nothing here depends on the playground being clear.
	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	Restaurant = GetWorld()->SpawnActor<ARestaurantBuilder>(ARestaurantBuilder::StaticClass(), FTransform::Identity, Params);
}