// Copyright Epic Games, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

/** Main log category used across the project */
DECLARE_LOG_CATEGORY_EXTERN(Logtony, Log, All);

/** Dedicated category for the headless smoke test (Tools/smoke_test.ps1)
 *  to grep for — kept separate from Logtony so a matching line is never
 *  ambiguous with an unrelated template warning under the same tag. */
DECLARE_LOG_CATEGORY_EXTERN(LogFrontlineSmoke, Log, All);
